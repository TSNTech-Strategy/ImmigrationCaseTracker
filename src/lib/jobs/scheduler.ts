import type { PrismaClient } from "@prisma/client";
import type { CaseService } from "@/lib/cases/service";
import { firmChecksAllowedWhere } from "@/lib/billing/entitlements";

/** How often the scheduler wakes up. */
export const SCHEDULER_TICK_MINUTES = 15;
/** Max cases dispatched per tick (keeps one tick well inside rate limits). */
export const MAX_DISPATCH_PER_TICK = 500;

const OUTAGE_WINDOW_MS = 15 * 60 * 1000;
const OUTAGE_MIN_FAILURES = 20;
const OUTAGE_KINDS = ["server", "timeout", "network", "auth", "rate_limited"];

/**
 * Cases due for an automatic check: tracking active, an active (not withdrawn)
 * consent, and nextCheckAt reached (or never scheduled). Oldest first.
 */
export async function findDueCaseIds(db: PrismaClient, now: Date, limit = MAX_DISPATCH_PER_TICK): Promise<string[]> {
  const rows = await db.trackedCase.findMany({
    where: {
      trackingStatus: "ACTIVE",
      consents: { some: { withdrawnAt: null } },
      AND: [
        { OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] },
        // Firm cases only while the firm is active and paid (or in its trial).
        { OR: [{ firmId: null }, { firm: firmChecksAllowedWhere(now) }] },
        // Personal cases only on Premium (Free has no automatic checks).
        { OR: [{ ownerUserId: null }, { ownerUser: { plan: "PREMIUM" } }] },
      ],
    },
    orderBy: [{ nextCheckAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Circuit breaker: if USCIS calls have been failing in bulk with no successes
 * in the last 15 minutes, skip this tick instead of hammering a broken API.
 */
export async function uscisLooksDown(db: PrismaClient, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - OUTAGE_WINDOW_MS);
  const [failures, successes] = await Promise.all([
    db.caseCheckRun.count({ where: { attemptedAt: { gte: since }, outcome: { in: OUTAGE_KINDS } } }),
    db.caseCheckRun.count({ where: { attemptedAt: { gte: since }, outcome: "ok" } }),
  ]);
  return failures >= OUTAGE_MIN_FAILURES && successes === 0;
}

/** Slot id so a case is dispatched at most once per tick even if a tick re-runs. */
export function tickSlot(now: Date): number {
  return Math.floor(now.getTime() / (SCHEDULER_TICK_MINUTES * 60 * 1000));
}

export type ScheduledCheckOutcome =
  | { checked: false; reason: "missing" | "not_due" }
  | { checked: true; status: string; changed: boolean; eventId?: string };

/**
 * One scheduled check. Re-reads the case and re-checks that it's still due,
 * so a duplicate or late event never causes an extra USCIS call.
 */
export async function runScheduledCheck(
  db: PrismaClient,
  service: Pick<CaseService, "runCheck">,
  caseId: string,
  now: Date,
): Promise<ScheduledCheckOutcome> {
  const c = await db.trackedCase.findUnique({ where: { id: caseId } });
  if (!c) return { checked: false, reason: "missing" };
  if (c.nextCheckAt && c.nextCheckAt > now) return { checked: false, reason: "not_due" };
  const r = await service.runCheck(c, "SCHEDULED");
  return {
    checked: true,
    status: r.status,
    changed: r.status === "updated" && r.changed,
    eventId: r.status === "updated" ? r.eventId : undefined,
  };
}
