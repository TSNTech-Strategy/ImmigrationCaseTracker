import type { BillingProduct, Firm, FirmPlan, Plan, PrismaClient, Subscription } from "@prisma/client";
import { FIRM_PLANS, PLAN_LIMITS } from "@/lib/plans";
import { TRIAL_CASE_LIMIT } from "@/lib/firms/service";
import { firmPlanForProduct } from "./catalog";

/**
 * Turns Stripe subscription state into what someone may use.
 *
 * - Paid access: status active or trialing, or past_due for up to
 *   GRACE_DAYS while Stripe retries the card.
 * - Individuals: Premium -> up to 10 actively checked cases. Free -> 1. On a
 *   downgrade the oldest case stays checked and the rest pause with
 *   pausedReason "plan_limit" (nothing is deleted); the person can choose
 *   another case to keep checked. Upgrading resumes them.
 * - Firms: a paid plan sets the case limit (Solo 50, Firm 300). Without one,
 *   the trial's limit applies, and after the trial ends the firm's cases
 *   aren't checked (see firmChecksAllowed) until it subscribes.
 */

export const GRACE_DAYS = 7;
export const PLAN_LIMIT = "plan_limit";

type SubLike = Pick<Subscription, "status" | "pastDueSince" | "product">;

export function isEntitled(s: SubLike, now: Date): boolean {
  if (s.status === "active" || s.status === "trialing") return true;
  if (s.status === "past_due") return !s.pastDueSince || now.getTime() - s.pastDueSince.getTime() < GRACE_DAYS * 86_400_000;
  return false;
}

/** May this firm's cases be checked right now? (paid plan, or trial still running) */
export function firmChecksAllowed(firm: Pick<Firm, "plan" | "trialEndsAt" | "status">, now: Date): boolean {
  if (firm.status !== "ACTIVE") return false;
  return Boolean(firm.plan) || Boolean(firm.trialEndsAt && firm.trialEndsAt > now);
}

/** Prisma filter version of firmChecksAllowed, for the scheduler. */
export const firmChecksAllowedWhere = (now: Date) => ({
  status: "ACTIVE" as const,
  OR: [{ plan: { not: null } }, { trialEndsAt: { gt: now } }],
});

export function createEntitlements({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  /** Recompute a user's plan from their subscriptions and pause/resume cases to fit. */
  async function applyUser(userId: string) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!user) return null;
    const t = now();
    const subs = await db.subscription.findMany({ where: { userId, product: "PREMIUM" } });
    const plan: Plan = subs.some((s) => isEntitled(s, t)) ? "PREMIUM" : "FREE";
    if (plan !== user.plan) {
      await db.user.update({ where: { id: userId }, data: { plan } });
      await db.auditLog.create({
        data: { actorUserId: userId, action: "plan.changed", targetType: "User", targetId: userId, metadata: { from: user.plan, to: plan } },
      });
    }
    const { paused, resumed } = await fitCasesToPlan(userId, plan);
    return { plan, changed: plan !== user.plan, paused, resumed };
  }

  async function fitCasesToPlan(userId: string, plan: Plan) {
    const limit = PLAN_LIMITS[plan].maxCases;
    const active = await db.trackedCase.findMany({
      where: { ownerUserId: userId, trackingStatus: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (active.length > limit) {
      const extra = active.slice(limit).map((c) => c.id);
      await db.trackedCase.updateMany({ where: { id: { in: extra } }, data: { trackingStatus: "PAUSED", pausedReason: PLAN_LIMIT } });
      return { paused: extra.length, resumed: 0 };
    }
    const room = limit - active.length;
    if (room <= 0) return { paused: 0, resumed: 0 };
    const waiting = await db.trackedCase.findMany({
      where: { ownerUserId: userId, trackingStatus: "PAUSED", pausedReason: PLAN_LIMIT },
      orderBy: { createdAt: "asc" },
      take: room,
      select: { id: true },
    });
    if (waiting.length) {
      await db.trackedCase.updateMany({
        where: { id: { in: waiting.map((c) => c.id) } },
        data: { trackingStatus: "ACTIVE", pausedReason: null, nextCheckAt: now() },
      });
    }
    return { paused: 0, resumed: waiting.length };
  }

  /**
   * On a plan that's full (e.g. Free with 1 case), check this case instead of
   * the one currently checked. Only cases paused for the plan limit qualify.
   */
  async function chooseCheckedCase(userId: string, caseId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!user) return { ok: false, error: "Account not found." };
    const target = await db.trackedCase.findFirst({ where: { id: caseId, ownerUserId: userId, trackingStatus: "PAUSED", pausedReason: PLAN_LIMIT } });
    if (!target) return { ok: false, error: "Case not found." };
    const limit = PLAN_LIMITS[user.plan].maxCases;
    const active = await db.trackedCase.findMany({
      where: { ownerUserId: userId, trackingStatus: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    await db.$transaction(async (tx) => {
      const over = active.length + 1 - limit;
      if (over > 0) {
        await tx.trackedCase.updateMany({
          where: { id: { in: active.slice(0, over).map((c) => c.id) } },
          data: { trackingStatus: "PAUSED", pausedReason: PLAN_LIMIT },
        });
      }
      await tx.trackedCase.update({ where: { id: target.id }, data: { trackingStatus: "ACTIVE", pausedReason: null, nextCheckAt: now() } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: "case.checked_instead", targetType: "TrackedCase", targetId: target.id } });
    });
    return { ok: true };
  }

  /** Recompute a firm's plan and case limit from its subscriptions. */
  async function applyFirm(firmId: string) {
    const firm = await db.firm.findUnique({ where: { id: firmId }, select: { plan: true, caseLimit: true } });
    if (!firm) return null;
    const t = now();
    const subs = await db.subscription.findMany({ where: { firmId } });
    const paid = subs.filter((s) => isEntitled(s, t)).map((s) => firmPlanForProduct(s.product as BillingProduct)).filter(Boolean) as FirmPlan[];
    const plan: FirmPlan | null = paid.includes("FIRM") ? "FIRM" : paid.includes("SOLO") ? "SOLO" : null;
    const caseLimit = plan ? FIRM_PLANS[plan].maxCases : TRIAL_CASE_LIMIT;
    if (plan !== firm.plan || caseLimit !== firm.caseLimit) {
      await db.firm.update({ where: { id: firmId }, data: { plan, caseLimit } });
      await db.auditLog.create({
        data: { firmId, action: "firm.plan_changed", targetType: "Firm", targetId: firmId, metadata: { from: firm.plan, to: plan, caseLimit } },
      });
    }
    return { plan, caseLimit, changed: plan !== firm.plan };
  }

  return { applyUser, applyFirm, chooseCheckedCase, fitCasesToPlan };
}

export type Entitlements = ReturnType<typeof createEntitlements>;
