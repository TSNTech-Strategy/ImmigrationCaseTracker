import type { PrismaClient } from "@prisma/client";
import { firmChecksAllowedWhere } from "@/lib/billing/entitlements";
import { cadenceTier, checksPerDay, TIER_HOURS, type CadenceTier } from "@/lib/cases/cadence";
import { PLAN_LIMITS } from "@/lib/plans";
import { SCHEDULED_SHARE } from "./scheduler";

/**
 * How much of the USCIS daily quota automatic checks need, at each case's current cadence. Lets
 * us see whether there's room for a new firm before we sell it, and set plan limits honestly.
 */
export type Capacity = {
  budget: number;
  scheduledBudget: number;
  cases: number;
  byTier: Record<CadenceTier, number>;
  checksPerDay: number;
  /** Share of the automatic budget in use (can go over 1). */
  utilization: number;
  /** About how many more cases fit at today's mix of cadences. */
  roomForCases: number;
  /** The same, if every new case needed checks twice a day (worst case). */
  roomForActiveCases: number;
};

export async function estimateCapacity(db: PrismaClient, now: Date, budget: number): Promise<Capacity> {
  const rows = await db.trackedCase.findMany({
    where: {
      trackingStatus: "ACTIVE",
      consents: { some: { withdrawnAt: null } },
      OR: [{ firmId: null, ownerUser: { plan: "PREMIUM" } }, { firmId: { not: null }, firm: firmChecksAllowedWhere(now) }],
    },
    select: { statusTitleEn: true, lastChangeObservedAt: true, createdAt: true, firmId: true },
  });
  const minHours = PLAN_LIMITS.PREMIUM.checkIntervalHours;
  const byTier: Record<CadenceTier, number> = { active: 0, steady: 0, quiet: 0, settled: 0 };
  let perDay = 0;
  for (const r of rows) {
    byTier[cadenceTier(r, now)]++;
    perDay += checksPerDay(r, now, minHours);
  }
  const scheduledBudget = Math.floor(budget * SCHEDULED_SHARE);
  const free = Math.max(0, scheduledBudget - perDay);
  const avg = rows.length ? perDay / rows.length : 24 / TIER_HOURS.steady;
  return {
    budget,
    scheduledBudget,
    cases: rows.length,
    byTier,
    checksPerDay: Math.round(perDay * 10) / 10,
    utilization: scheduledBudget ? perDay / scheduledBudget : 0,
    roomForCases: Math.floor(free / avg),
    roomForActiveCases: Math.floor(free / (24 / TIER_HOURS.active)),
  };
}
