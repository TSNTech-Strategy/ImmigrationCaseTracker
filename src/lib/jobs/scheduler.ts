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
export async function findDueCaseIds(db: PrismaClient, now: Date, limit = MAX_DISPATCH_PER_TICK, allowance = limit): Promise<string[]> {
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
    select: { id: true, firmId: true, ownerUserId: true },
  });
  return pickFairly(rows, allowance);
}

/**
 * Take up to `allowance` cases, one per account in turn (most overdue first within each), so a
 * firm with 2,000 cases due can't use a whole tick while a family with one case waits.
 */
export function pickFairly(rows: { id: string; firmId: string | null; ownerUserId: string | null }[], allowance: number): string[] {
  const queues = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.firmId ? `f:${r.firmId}` : `u:${r.ownerUserId}`;
    const q = queues.get(key);
    if (q) q.push(r.id);
    else queues.set(key, [r.id]);
  }
  const picked: string[] = [];
  const lists = [...queues.values()];
  for (let i = 0; picked.length < allowance; i++) {
    let any = false;
    for (const q of lists) {
      if (i < q.length) {
        any = true;
        picked.push(q[i]!);
        if (picked.length >= allowance) break;
      }
    }
    if (!any) break;
  }
  return picked;
}

/** Share of the USCIS daily quota for automatic checks; the rest stays free for people pressing "Check now". */
export const SCHEDULED_SHARE = 0.8;

/**
 * How many automatic checks this tick may send: what's left of today's automatic share (UTC day,
 * as USCIS counts it), spread evenly over the ticks left today when USCIS can answer. Spreading
 * keeps a burst of due cases in the morning from using the whole day's quota.
 */
export async function scheduledAllowance(db: PrismaClient, now: Date, { budget, isOpen = () => true }: { budget: number; isOpen?: (at: Date) => boolean }): Promise<number> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const used = await db.caseCheckRun.count({ where: { attemptedAt: { gte: dayStart }, httpStatus: { not: null } } });
  const remaining = Math.floor(budget * SCHEDULED_SHARE) - used;
  if (remaining <= 0) return 0;
  const tickMs = SCHEDULER_TICK_MINUTES * 60 * 1000;
  const dayEnd = dayStart.getTime() + 86_400_000;
  let ticksLeft = 0;
  for (let at = now.getTime(); at < dayEnd; at += tickMs) if (isOpen(new Date(at))) ticksLeft++;
  return Math.min(MAX_DISPATCH_PER_TICK, Math.ceil(remaining / Math.max(1, ticksLeft)));
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
