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
  // Firm prices confirmed Nov 7, 2026: per firm, team members included; yearly = 10 months (2 months free).
  firmSolo: { monthly: 49, yearly: 490 },
  firm: { monthly: 129, yearly: 1290 },
  firmPlus: { monthly: 249, yearly: 2490 },
} as const;

/** Firm plans. Every plan has every workspace feature; they differ by team size and cases. The free trial is TRIAL_DAYS / TRIAL_CASE_LIMIT in lib/firms. */
export const FIRM_PLANS: Record<"SOLO" | "FIRM" | "PLUS", { label: string; maxCases: number; maxUsers: number | null; price: number; yearly: number; for: string }> = {
  SOLO: { label: "Solo", maxCases: 150, maxUsers: 2, price: PRICES.firmSolo.monthly, yearly: PRICES.firmSolo.yearly, for: "One attorney and an assistant" },
  FIRM: { label: "Firm", maxCases: 600, maxUsers: 10, price: PRICES.firm.monthly, yearly: PRICES.firm.yearly, for: "Small firms" },
  PLUS: { label: "Firm Plus", maxCases: 2000, maxUsers: null, price: PRICES.firmPlus.monthly, yearly: PRICES.firmPlus.yearly, for: "Growing firms" },
};
/** Smallest to largest. */
export const FIRM_PLAN_ORDER = ["SOLO", "FIRM", "PLUS"] as const;

/** Founding-firm launch offer, applied as a Stripe coupon in Step 8. */
export const FOUNDING_FIRM_OFFER = { percentOff: 50, months: 12, firms: 25 } as const;

/** 3.99 -> "$3.99", 29 -> "$29". */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", Number.isInteger(amount) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What a yearly price works out to per month, rounded down (29 -> "$2.41"). */
export function perMonth(yearly: number): string {
  return `$${(Math.floor((yearly / 12) * 100) / 100).toFixed(2)}`;
}
