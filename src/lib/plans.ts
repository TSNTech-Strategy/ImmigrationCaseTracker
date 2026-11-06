import type { Plan } from "@prisma/client";

// What each plan includes. Launch prices set Nov 5, 2026, priced to be the most
// affordable of the major USCIS trackers (see docs/BUILD_PLAN.md).
// Billing (Step 8) switches User.plan; until then it's set by hand.

/**
 * Free is deliberately limited (decided Nov 6, 2026, after a competitor and
 * freemium review): one case, no automatic checks and no alerts; the person
 * checks it themselves a few times a day. Premium adds automatic checks and
 * alerts. New accounts get a 7-day Premium trial (lib/billing/trial.ts).
 */
export const PLAN_LIMITS: Record<
  Plan,
  {
    maxCases: number;
    checkIntervalHours: number;
    label: string;
    autoChecks: boolean;
    alerts: boolean;
    manualChecksPerDay: number;
    /** Questions to the assistant per UTC day (each one is a paid AI call). */
    assistantPerDay: number;
  }
> = {
  FREE: { maxCases: 1, checkIntervalHours: 24, label: "Free", autoChecks: false, alerts: false, manualChecksPerDay: 3, assistantPerDay: 5 },
  PREMIUM: { maxCases: 10, checkIntervalHours: 12, label: "Premium", autoChecks: true, alerts: true, manualChecksPerDay: 30, assistantPerDay: 50 },
};

/** New accounts start with this many days of Premium. */
export const PREMIUM_TRIAL_DAYS = 7;

/** Firm cases are checked like Premium. */
export const FIRM_CHECK_INTERVAL_HOURS = 12;

export function checkIntervalMs(plan: Plan | null): number {
  const hours = plan ? PLAN_LIMITS[plan].checkIntervalHours : FIRM_CHECK_INTERVAL_HOURS;
  return hours * 60 * 60 * 1000;
}

export function describeCadence(plan: Plan): string {
  if (!PLAN_LIMITS[plan].autoChecks) return "only when you press Check now";
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
