import type { Plan } from "@prisma/client";

// What each plan includes. Launch prices set Nov 5, 2026, priced to be the most
// affordable of the major USCIS trackers (see docs/BUILD_PLAN.md).
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

/**
 * Launch prices in US dollars. The single source for the pricing page and,
 * in Step 8, the Stripe products. Change prices here only.
 */
export const PRICES = {
  premium: { monthly: 3.99, yearly: 29 },
  firmSolo: { monthly: 39 },
  firm: { monthly: 99 },
} as const;

/** Firm plans (billing in Step 8). The free trial is TRIAL_DAYS / TRIAL_CASE_LIMIT in lib/firms. */
export const FIRM_PLANS: Record<"SOLO" | "FIRM", { label: string; maxCases: number; maxUsers: number | null; price: number }> = {
  SOLO: { label: "Firm Solo", maxCases: 50, maxUsers: 2, price: PRICES.firmSolo.monthly },
  FIRM: { label: "Firm", maxCases: 300, maxUsers: null, price: PRICES.firm.monthly },
};

/** Founding-firm launch offer, applied as a Stripe coupon in Step 8. */
export const FOUNDING_FIRM_OFFER = { percentOff: 50, months: 12, firms: 25 } as const;

/** 3.99 -> "$3.99", 29 -> "$29". */
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** What a yearly price works out to per month, rounded down (29 -> "$2.41"). */
export function perMonth(yearly: number): string {
  return `$${(Math.floor((yearly / 12) * 100) / 100).toFixed(2)}`;
}
