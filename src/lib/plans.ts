import type { Plan } from "@prisma/client";

// What each plan includes (decided Nov 5, 2026 — see docs/BUILD_PLAN.md).
// Billing (Step 8) switches User.plan; until then it's set by hand.

export const PLAN_LIMITS: Record<Plan, { maxCases: number; checkIntervalHours: number; label: string }> = {
  FREE: { maxCases: 1, checkIntervalHours: 24, label: "Free" },
  PREMIUM: { maxCases: 10, checkIntervalHours: 12, label: "Premium" },
};

/** Firm cases are checked like Premium. */
export const FIRM_CHECK_INTERVAL_HOURS = 12;

export function checkIntervalMs(plan: Plan | null): number {
  const hours = plan ? PLAN_LIMITS[plan].checkIntervalHours : FIRM_CHECK_INTERVAL_HOURS;
  return hours * 60 * 60 * 1000;
}

export function describeCadence(plan: Plan): string {
  return PLAN_LIMITS[plan].checkIntervalHours >= 24 ? "about once a day" : "about twice a day";
}
