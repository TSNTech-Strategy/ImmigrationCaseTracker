import type { PrismaClient } from "@prisma/client";
import { FIRM_CHECK_INTERVAL_HOURS } from "@/lib/plans";
import { firmChecksAllowed } from "@/lib/billing/entitlements";
import { findFirmContext } from "./service";

/**
 * Sync: how the firm's cases are checked with USCIS. The schedule, whether checks are running,
 * what was checked recently and which cases USCIS couldn't answer for.
 */

const HOUR = 3_600_000;
/** Plain words for the last check's outcome. */
export const OUTCOME_LABELS: Record<string, string> = {
  ok: "Checked",
  not_configured: "USCIS connection not set up",
  invalid_receipt: "Receipt number looks wrong",
  auth: "USCIS refused our connection",
  bad_request: "USCIS didn't accept this receipt",
  not_found: "USCIS has no case for this receipt",
  rate_limited: "USCIS asked us to slow down",
  server: "USCIS had an error",
  timeout: "USCIS took too long",
  network: "Couldn't reach USCIS",
  bad_response: "USCIS sent an answer we couldn't read",
};
/** Outcomes that a person should look at (the others clear up on their own). */
export const NEEDS_ATTENTION = new Set(["invalid_receipt", "bad_request", "not_found"]);

export function createFirmSyncService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function overview(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const firmId = ctx.firm.id;
    const t = now();
    const dayAgo = new Date(t.getTime() - 24 * HOUR);
    const caseSelect = { id: true, receiptMasked: true, nickname: true, formType: true, lastCheckedAt: true, lastCheckOutcome: true, client: { select: { displayName: true } } } as const;
    const [active, paused, checkedDay, failing, next, recent, problems, neverChecked] = await Promise.all([
      db.trackedCase.count({ where: { firmId, trackingStatus: "ACTIVE" } }),
      db.trackedCase.count({ where: { firmId, trackingStatus: "PAUSED" } }),
      db.trackedCase.count({ where: { firmId, lastCheckedAt: { gte: dayAgo } } }),
      db.trackedCase.count({ where: { firmId, trackingStatus: "ACTIVE", lastCheckOutcome: { notIn: ["ok"] } } }),
      db.trackedCase.findFirst({ where: { firmId, trackingStatus: "ACTIVE", nextCheckAt: { not: null } }, select: { nextCheckAt: true }, orderBy: { nextCheckAt: "asc" } }),
      db.trackedCase.findMany({ where: { firmId, lastCheckedAt: { not: null } }, select: caseSelect, orderBy: { lastCheckedAt: "desc" }, take: 10 }),
      db.trackedCase.findMany({ where: { firmId, trackingStatus: "ACTIVE", lastCheckOutcome: { notIn: ["ok"] } }, select: caseSelect, orderBy: { lastCheckedAt: "desc" }, take: 25 }),
      db.trackedCase.count({ where: { firmId, trackingStatus: "ACTIVE", lastCheckedAt: null } }),
    ]);
    const running = firmChecksAllowed(ctx.firm, t);
    const health = !running ? "paused" : failing === 0 ? "good" : problems.some((p) => NEEDS_ATTENTION.has(p.lastCheckOutcome ?? "")) ? "attention" : "delayed";
    return {
      ctx,
      schedule: { everyHours: FIRM_CHECK_INTERVAL_HOURS, running, next: next?.nextCheckAt ?? null, dueNow: Boolean(next?.nextCheckAt && next.nextCheckAt <= t) },
      counts: { active, paused, checkedDay, failing, neverChecked },
      health: health as "good" | "delayed" | "attention" | "paused",
      recent,
      problems,
    };
  }
  return { overview };
}
