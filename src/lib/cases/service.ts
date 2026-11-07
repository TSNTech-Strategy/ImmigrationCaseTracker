import type { CheckTrigger, ConsentBasis, Prisma, PrismaClient, TrackedCase } from "@prisma/client";
import { isSandboxReceipt } from "@/lib/receipt";
import type { CaseStatusSnapshot } from "@/lib/uscis/normalize";
import { UscisError } from "@/lib/uscis/errors";
import type { CaseStatusResult } from "@/lib/uscis/client";
import { CONSENT_STATEMENT_VERSION } from "./consent";
import {
  checkFailureMessage,
  cooldownRemainingMs,
  formatWait,
  MANUAL_REFRESH_COOLDOWN_MS,
  MANUAL_REFRESHES_PER_FIRM_PER_DAY,
  MANUAL_REFRESHES_PER_USER_PER_DAY,
  nextCheckAfterFailure,
  startOfUtcDay,
  uscisDailyBudget,
} from "./policy";
import { InvalidReceiptError, protectReceipt, revealReceipt } from "./receipt-store";
import { redactSnapshot } from "@/lib/uscis/text";
import { checkIntervalMs, formatUsd, PLAN_LIMITS, PRICES } from "@/lib/plans";
import { firmChecksAllowed } from "@/lib/billing/entitlements";
import { createTrialService } from "@/lib/billing/trial";
import { caseTagsSelect } from "./tags";

/**
 * Everything a signed-in individual can do with their own cases.
 *
 * Authorization rule: every query is scoped by ownerUserId = the caller. A
 * case that belongs to someone else is indistinguishable from one that
 * doesn't exist (null / "not_found") — no existence leak.
 */

export type UscisPort = {
  mode: "mock" | "sandbox" | "production";
  getCaseStatus(receipt: string): Promise<CaseStatusResult>;
};

export type CaseServiceDeps = {
  db: PrismaClient;
  uscis: UscisPort;
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

export type AddCaseInput = { receipt: string; nickname?: string | null; basis: Extract<ConsentBasis, "SELF" | "AUTHORIZED_BY_APPLICANT"> };

export type AddCaseResult =
  | { ok: true; caseId: string; check: RefreshResult }
  | { ok: false; error: "invalid_receipt" | "duplicate" | "limit"; message: string };

export type RefreshResult =
  /** eventId: the CaseStatusEvent recording the change, when changed. */
  | { status: "updated"; changed: boolean; eventId?: string; message: string }
  | { status: "failed"; message: string }
  | { status: "cooldown" | "limit" | "budget" | "no_consent" | "paused" | "not_found"; message: string };

/** The case fields safe to show in the UI (no ciphertext or digests). */
export const caseViewSelect = {
  id: true,
  receiptMasked: true,
  nickname: true,
  trackingStatus: true,
  pausedReason: true,
  formType: true,
  statusTitleEn: true,
  statusTitleEs: true,
  statusDescriptionEn: true,
  statusDescriptionEs: true,
  uscisSubmittedRaw: true,
  uscisModifiedRaw: true,
  uscisHistory: true,
  lastCheckedAt: true,
  lastCheckOutcome: true,
  lastChangeObservedAt: true,
  createdAt: true,
} satisfies Prisma.TrackedCaseSelect;

export type CaseView = Prisma.TrackedCaseGetPayload<{ select: typeof caseViewSelect }>;

export function createCaseService({ db, uscis, now = () => new Date(), env = process.env }: CaseServiceDeps) {
  const own = (userId: string, caseId: string) => ({ id: caseId, ownerUserId: userId });

  async function listCases(userId: string) {
    return db.trackedCase.findMany({
      where: { ownerUserId: userId },
      // The changes CasePingo saw count for the line map too, so the list agrees with the case page and the app.
      select: { ...caseViewSelect, ...caseTagsSelect, events: { select: { statusTitleEn: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async function getCase(userId: string, caseId: string) {
    return db.trackedCase.findFirst({
      where: own(userId, caseId),
      select: {
        ...caseViewSelect,
        ...caseTagsSelect,
        events: { orderBy: { firstObservedAt: "desc" }, take: 50 },
        consents: { orderBy: { capturedAt: "desc" }, take: 5 },
      },
    });
  }

  async function addCase(userId: string, input: AddCaseInput): Promise<AddCaseResult> {
    let protectedReceipt;
    try {
      protectedReceipt = protectReceipt(input.receipt);
    } catch (err) {
      if (err instanceof InvalidReceiptError) return { ok: false, error: "invalid_receipt", message: err.message };
      throw err;
    }

    const duplicate = await db.trackedCase.findUnique({
      where: { ownerUserId_receiptDigest: { ownerUserId: userId, receiptDigest: protectedReceipt.receiptDigest } },
      select: { id: true },
    });
    if (duplicate) return { ok: false, error: "duplicate", message: "You're already tracking this receipt number." };

    // Trial guard: a receipt that already had a trial on another account ends this one's trial.
    await createTrialService({ db, now }).guardReceiptDuringTrial(userId, input.receipt);
    const owner = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const plan = owner?.plan ?? "FREE";
    const limit = PLAN_LIMITS[plan].maxCases;
    if ((await db.trackedCase.count({ where: { ownerUserId: userId } })) >= limit) {
      return {
        ok: false,
        error: "limit",
        message:
          plan === "FREE"
            ? `The Free plan includes 1 case. Premium (${formatUsd(PRICES.premium.yearly)}/year) tracks up to 10 family cases, checks them automatically and alerts you.`
            : `Your plan includes up to ${limit} cases.`,
      };
    }

    const nickname = input.nickname?.trim().slice(0, 60) || null;
    let created: TrackedCase;
    try {
      created = await db.$transaction(async (tx) => {
        const c = await tx.trackedCase.create({
          data: {
            ...protectedReceipt,
            nickname,
            ownerUserId: userId,
            addedById: userId,
            consents: {
              create: {
                basis: input.basis,
                source: "WEB",
                statementVersion: CONSENT_STATEMENT_VERSION,
                grantedById: userId,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: { actorUserId: userId, action: "case.created", targetType: "TrackedCase", targetId: c.id, metadata: { basis: input.basis } },
        });
        return c;
      });
    } catch (err) {
      // Two simultaneous adds of the same receipt: the unique index wins.
      if ((err as { code?: string }).code === "P2002") {
        return { ok: false, error: "duplicate", message: "You're already tracking this receipt number." };
      }
      throw err;
    }

    const check = await runCheck(created, "INITIAL");
    return { ok: true, caseId: created.id, check };
  }

  async function removeCase(userId: string, caseId: string): Promise<boolean> {
    return db.$transaction(async (tx) => {
      const { count } = await tx.trackedCase.deleteMany({ where: own(userId, caseId) });
      if (count === 0) return false;
      await tx.auditLog.create({
        data: { actorUserId: userId, action: "case.removed", targetType: "TrackedCase", targetId: caseId },
      });
      return true;
    });
  }

  /** "Refresh now" from the case page. */
  async function refreshCase(userId: string, caseId: string): Promise<RefreshResult> {
    const plan = (await db.user.findUnique({ where: { id: userId }, select: { plan: true } }))?.plan ?? "FREE";
    const perDay = Math.min(PLAN_LIMITS[plan].manualChecksPerDay, MANUAL_REFRESHES_PER_USER_PER_DAY);
    const r = await refreshScoped({ id: caseId, ownerUserId: userId }, { ownerUserId: userId }, perDay);
    if (r.status === "limit" && plan === "FREE") {
      return {
        status: "limit",
        message: `The Free plan includes ${perDay} checks a day. Premium checks your cases automatically and alerts you when they change.`,
      };
    }
    return r;
  }

  /** "Refresh now" on a firm case. The caller has already checked firm membership. */
  async function refreshFirmCase(firmId: string, caseId: string): Promise<RefreshResult> {
    return refreshScoped({ id: caseId, firmId }, { firmId }, MANUAL_REFRESHES_PER_FIRM_PER_DAY);
  }

  async function refreshScoped(
    where: Prisma.TrackedCaseWhereInput,
    quotaScope: Prisma.TrackedCaseWhereInput,
    perDay: number,
  ): Promise<RefreshResult> {
    const c = await db.trackedCase.findFirst({ where });
    if (!c) return { status: "not_found", message: "Case not found." };

    if (c.trackingStatus !== "ACTIVE") return { status: "paused", message: "Tracking is paused for this case." };
    const consent = await db.caseConsent.findFirst({ where: { caseId: c.id, withdrawnAt: null }, select: { id: true } });
    if (!consent) return { status: "no_consent", message: "This case has no active consent, so it isn't checked." };

    const t = now();
    const wait = cooldownRemainingMs(c.lastCheckedAt, t);
    if (wait > 0) {
      return { status: "cooldown", message: `This case was checked recently. You can refresh again in ${formatWait(wait)}.` };
    }

    const manualToday = await db.caseCheckRun.count({
      where: { trigger: "MANUAL", attemptedAt: { gte: startOfUtcDay(t) }, case: quotaScope },
    });
    if (manualToday >= perDay) {
      return { status: "limit", message: "You've reached today's limit for manual refreshes. Cases are still checked automatically." };
    }

    // Atomically claim the cooldown window so double-clicks can't both call USCIS.
    const cutoff = new Date(t.getTime() - MANUAL_REFRESH_COOLDOWN_MS);
    const claimed = await db.trackedCase.updateMany({
      where: { id: c.id, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: cutoff } }] },
      data: { lastCheckedAt: t },
    });
    if (claimed.count === 0) {
      return { status: "cooldown", message: "This case is being checked right now. Try again in a few minutes." };
    }

    return runCheck(c, "MANUAL");
  }

  /** One USCIS call for a case, with all the guards. Used by add, refresh and (Step 6) the scheduler. */
  async function runCheck(c: TrackedCase, trigger: CheckTrigger): Promise<RefreshResult> {
    const t = now();

    if (c.trackingStatus !== "ACTIVE") return { status: "paused", message: "Tracking is paused for this case." };

    if (c.firmId) {
      const firm = await db.firm.findUnique({ where: { id: c.firmId }, select: { plan: true, trialEndsAt: true, status: true } });
      if (!firm || !firmChecksAllowed(firm, t)) {
        return { status: "paused", message: "Your firm's free trial has ended. Choose a plan in Firm → Billing to turn checks back on." };
      }
    }

    const consent = await db.caseConsent.findFirst({ where: { caseId: c.id, withdrawnAt: null }, select: { id: true } });
    if (!consent) return { status: "no_consent", message: "This case has no active consent, so it isn't checked." };

    const usedToday = await db.caseCheckRun.count({
      where: { attemptedAt: { gte: startOfUtcDay(t) }, httpStatus: { not: null } },
    });
    if (usedToday >= uscisDailyBudget(env)) {
      await db.trackedCase.update({ where: { id: c.id }, data: { nextCheckAt: new Date(t.getTime() + 60 * 60 * 1000) } });
      return { status: "budget", message: "We've paused checks for today to stay within USCIS limits. We'll try again soon." };
    }

    const receipt = revealReceipt(c);

    // Sandbox may only ever see USCIS's published sample receipts.
    if (uscis.mode === "sandbox" && !isSandboxReceipt(receipt, env)) {
      await recordFailure(c, trigger, t, "sandbox_only", null, 0);
      return { status: "failed", message: checkFailureMessage("sandbox_only") };
    }

    const started = Date.now();
    try {
      const result = await uscis.getCaseStatus(receipt);
      // USCIS text can contain the full receipt number — never store it.
      const { changed, eventId } = await applySnapshot(c, redactSnapshot(result.snapshot, receipt), t);
      await db.caseCheckRun.create({
        data: {
          caseId: c.id,
          trigger,
          uscisEnv: uscis.mode,
          httpStatus: result.httpStatus,
          outcome: "ok",
          durationMs: result.durationMs,
          changed,
          attemptedAt: t,
        },
      });
      return {
        status: "updated",
        changed,
        eventId,
        message: changed ? "Status updated from USCIS." : "Checked with USCIS. No change since the last check.",
      };
    } catch (err) {
      const e = err instanceof UscisError ? err : new UscisError("network", "unexpected error");
      await recordFailure(c, trigger, t, e.kind, e.httpStatus, Date.now() - started);
      return { status: "failed", message: checkFailureMessage(e.kind) };
    }
  }

  async function recordFailure(c: TrackedCase, trigger: CheckTrigger, t: Date, outcome: string, httpStatus: number | null, durationMs: number) {
    const failures = c.consecutiveFailures + 1;
    await db.$transaction([
      db.caseCheckRun.create({ data: { caseId: c.id, trigger, uscisEnv: uscis.mode, httpStatus, outcome, durationMs, attemptedAt: t } }),
      db.trackedCase.update({
        where: { id: c.id },
        data: { lastCheckedAt: t, lastCheckOutcome: outcome, consecutiveFailures: failures, nextCheckAt: nextCheckAfterFailure(t, failures) },
      }),
    ]);
  }

  /** Save the latest status; record an event only when the fingerprint changes. */
  async function applySnapshot(c: TrackedCase, s: CaseStatusSnapshot, t: Date): Promise<{ changed: boolean; eventId?: string }> {
    const changed = c.statusFingerprint !== s.fingerprint;
    // Individuals are checked per their plan; firm cases like Premium.
    const ownerPlan = c.ownerUserId
      ? ((await db.user.findUnique({ where: { id: c.ownerUserId }, select: { plan: true } }))?.plan ?? "FREE")
      : null;
    let eventId: string | undefined;
    await db.$transaction(async (tx) => {
      if (changed) {
        const event = await tx.caseStatusEvent.upsert({
          where: { caseId_fingerprint: { caseId: c.id, fingerprint: s.fingerprint } },
          update: {},
          create: {
              caseId: c.id,
              formType: s.formType,
              statusTitleEn: s.status.en.title,
              statusTitleEs: s.status.es.title,
              statusDescriptionEn: s.status.en.description,
              statusDescriptionEs: s.status.es.description,
              uscisReportedRaw: s.modifiedDate?.raw ?? null,
              fingerprint: s.fingerprint,
              firstObservedAt: t,
          },
          select: { id: true },
        });
        eventId = event.id;
      }
      await tx.trackedCase.update({
        where: { id: c.id },
        data: {
          formType: s.formType,
          statusTitleEn: s.status.en.title,
          statusTitleEs: s.status.es.title,
          statusDescriptionEn: s.status.en.description,
          statusDescriptionEs: s.status.es.description,
          uscisSubmittedRaw: s.submittedDate?.raw ?? null,
          uscisModifiedRaw: s.modifiedDate?.raw ?? null,
          uscisHistory: s.history as unknown as Prisma.InputJsonValue,
          statusFingerprint: s.fingerprint,
          statusSource: uscis.mode,
          lastCheckedAt: t,
          lastCheckOutcome: "ok",
          consecutiveFailures: 0,
          nextCheckAt: new Date(t.getTime() + checkIntervalMs(ownerPlan)),
          ...(changed ? { lastChangeObservedAt: t } : {}),
        },
      });
    });
    return { changed, eventId };
  }

  return { listCases, getCase, addCase, removeCase, refreshCase, refreshFirmCase, runCheck };
}

export type CaseService = ReturnType<typeof createCaseService>;
