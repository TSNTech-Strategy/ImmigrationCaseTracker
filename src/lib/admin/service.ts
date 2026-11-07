import type { DeletionStatus, PrismaClient } from "@prisma/client";
import { startOfUtcDay, uscisDailyBudget } from "@/lib/cases/policy";
import { uscisLooksDown } from "@/lib/jobs/scheduler";

/**
 * The admin overview: service health and counts. Sanitized by design:
 * no receipt numbers, no USCIS payloads, no client details. Emails are
 * masked except on deletion requests, where the admin needs them to reply.
 */

export const OVERDUE_AFTER_MS = 60 * 60_000;

/** "amrullo@tsntech.org" -> "a******@tsntech.org" */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

export function createAdminService({ db, now = () => new Date(), env = process.env }: { db: PrismaClient; now?: () => Date; env?: Record<string, string | undefined> }) {
  async function overview() {
    const t = now();
    const today = startOfUtcDay(t);
    const day = new Date(t.getTime() - 86_400_000);
    const week = new Date(t.getTime() - 7 * 86_400_000);

    const [
      usedToday,
      outcomes,
      lastOk,
      lastScheduled,
      down,
      overdue,
      sent7,
      failed7,
      recentFailures,
      users,
      newUsers,
      premium,
      firms,
      firmsByPlan,
      trialFirms,
      casesByOwner,
      pausedCases,
      subsByStatus,
      pastDue,
    ] = await Promise.all([
      db.caseCheckRun.count({ where: { attemptedAt: { gte: today }, httpStatus: { not: null } } }),
      db.caseCheckRun.groupBy({ by: ["outcome"], where: { attemptedAt: { gte: day } }, _count: { _all: true } }),
      db.caseCheckRun.findFirst({ where: { outcome: "ok" }, orderBy: { attemptedAt: "desc" }, select: { attemptedAt: true } }),
      db.caseCheckRun.findFirst({ where: { trigger: "SCHEDULED" }, orderBy: { attemptedAt: "desc" }, select: { attemptedAt: true } }),
      uscisLooksDown(db, t),
      db.trackedCase.count({
        where: {
          trackingStatus: "ACTIVE",
          consents: { some: { withdrawnAt: null } },
          nextCheckAt: { lt: new Date(t.getTime() - OVERDUE_AFTER_MS) },
        },
      }),
      db.notificationDelivery.count({ where: { status: "SENT", createdAt: { gte: week } } }),
      db.notificationDelivery.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
      db.notificationDelivery.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, createdAt: true, error: true, user: { select: { email: true } } },
      }),
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: week } } }),
      db.user.count({ where: { plan: "PREMIUM" } }),
      db.firm.count({ where: { status: "ACTIVE" } }),
      db.firm.groupBy({ by: ["plan"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      db.firm.count({ where: { status: "ACTIVE", plan: null, trialEndsAt: { gt: t } } }),
      Promise.all([db.trackedCase.count({ where: { ownerUserId: { not: null } } }), db.trackedCase.count({ where: { firmId: { not: null } } })]),
      db.trackedCase.count({ where: { trackingStatus: "PAUSED" } }),
      db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      db.subscription.findMany({
        where: { status: "past_due" },
        orderBy: { pastDueSince: "asc" },
        take: 20,
        select: { id: true, product: true, pastDueSince: true, user: { select: { email: true } }, firm: { select: { name: true } } },
      }),
    ]);

    const planCount = (p: "SOLO" | "FIRM" | "PLUS" | null) => firmsByPlan.find((f) => f.plan === p)?._count._all ?? 0;
    return {
      uscis: {
        usedToday,
        budget: uscisDailyBudget(env),
        outcomes24h: outcomes.map((o) => ({ outcome: o.outcome, count: o._count._all })).sort((a, b) => b.count - a.count),
        lastOkAt: lastOk?.attemptedAt ?? null,
        lastScheduledAt: lastScheduled?.attemptedAt ?? null,
        circuitOpen: down,
        overdue,
      },
      notifications: {
        sent7,
        failed7,
        recentFailures: recentFailures.map((f) => ({ id: f.id, at: f.createdAt, to: maskEmail(f.user.email), error: (f.error ?? "").slice(0, 160) })),
      },
      people: {
        users,
        newUsers,
        premium,
        firms,
        firmSolo: planCount("SOLO"),
        firmFirm: planCount("FIRM"),
        firmPlus: planCount("PLUS"),
        trialFirms,
        lapsedFirms: planCount(null) - trialFirms,
        individualCases: casesByOwner[0],
        firmCases: casesByOwner[1],
        pausedCases,
      },
      billing: {
        byStatus: subsByStatus.map((s) => ({ status: s.status, count: s._count._all })).sort((a, b) => b.count - a.count),
        pastDue: pastDue.map((s) => ({
          id: s.id,
          product: s.product,
          since: s.pastDueSince,
          who: s.user ? maskEmail(s.user.email) : (s.firm?.name ?? "Deleted account"),
        })),
      },
    };
  }

  async function deletionRequests() {
    return db.deletionRequest.findMany({
      where: { status: { in: ["REQUESTED", "IN_PROGRESS"] } },
      orderBy: { requestedAt: "asc" },
      select: { id: true, scope: true, requesterEmail: true, requesterId: true, targetId: true, status: true, notes: true, requestedAt: true },
    });
  }

  /** Close a request by hand (after handling it outside the app, or declining it). Audit-logged. */
  async function closeDeletionRequest(adminUserId: string, id: string, status: Extract<DeletionStatus, "COMPLETED" | "REJECTED">, note: string) {
    const clean = note.trim().slice(0, 300);
    if (status === "REJECTED" && clean.length < 3) return { ok: false as const, error: "Add a short reason when declining a request." };
    const { count } = await db.deletionRequest.updateMany({
      where: { id, status: { in: ["REQUESTED", "IN_PROGRESS"] } },
      data: { status, notes: clean || null, completedAt: now() },
    });
    if (count === 0) return { ok: false as const, error: "Request not found or already closed." };
    await db.auditLog.create({ data: { actorUserId: adminUserId, action: `admin.deletion_${status.toLowerCase()}`, targetType: "DeletionRequest", targetId: id } });
    return { ok: true as const };
  }

  return { overview, deletionRequests, closeDeletionRequest };
}
