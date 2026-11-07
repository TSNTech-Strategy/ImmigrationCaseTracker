import type { BillingProduct, FirmPlan } from "@prisma/client";
import { PRICES } from "@/lib/plans";

/**
 * What we sell, keyed by Stripe price lookup keys. `npm run stripe:setup`
 * creates these products and prices in Stripe from this list, so price IDs
 * never have to be copied into environment variables.
 */
export const CATALOG = {
  casepingo_premium_month: { product: "PREMIUM", interval: "month", amount: PRICES.premium.monthly },
  casepingo_premium_year: { product: "PREMIUM", interval: "year", amount: PRICES.premium.yearly },
  casepingo_firm_solo_month: { product: "FIRM_SOLO", interval: "month", amount: PRICES.firmSolo.monthly },
  casepingo_firm_solo_year: { product: "FIRM_SOLO", interval: "year", amount: PRICES.firmSolo.yearly },
  casepingo_firm_month: { product: "FIRM", interval: "month", amount: PRICES.firm.monthly },
  casepingo_firm_year: { product: "FIRM", interval: "year", amount: PRICES.firm.yearly },
  casepingo_firm_plus_month: { product: "FIRM_PLUS", interval: "month", amount: PRICES.firmPlus.monthly },
  casepingo_firm_plus_year: { product: "FIRM_PLUS", interval: "year", amount: PRICES.firmPlus.yearly },
} as const satisfies Record<string, { product: BillingProduct; interval: "month" | "year"; amount: number }>;
export type LookupKey = keyof typeof CATALOG;

export const PRODUCTS: Record<BillingProduct, { id: string; name: string; description: string; taxCode: string }> = {
  // Stripe product tax codes: SaaS for personal use / for business use.
  PREMIUM: { id: "casepingo_premium", name: "CasePingo Premium", description: "Up to 10 USCIS cases for you and your family, checked twice a day.", taxCode: "txcd_10103000" },
  FIRM_SOLO: { id: "casepingo_firm_solo", name: "CasePingo Pro: Solo", description: "Up to 150 client cases and 2 team members.", taxCode: "txcd_10103001" },
  FIRM: { id: "casepingo_firm", name: "CasePingo Pro: Firm", description: "Up to 600 client cases and 10 team members.", taxCode: "txcd_10103001" },
  FIRM_PLUS: { id: "casepingo_firm_plus", name: "CasePingo Pro: Firm Plus", description: "Up to 2,000 client cases and unlimited team members.", taxCode: "txcd_10103001" },
};

/**
 * Founding-firm offer coupon (50% off for 12 months, first 25 firms). A Stripe coupon's products can't
 * be changed, so adding Firm Plus needed a new coupon id (v2 covers all three firm plans).
 */
export const FOUNDING_COUPON_ID = "casepingo_founding_firm_50_v2";

const FIRM_PRODUCTS: Record<FirmPlan, BillingProduct> = { SOLO: "FIRM_SOLO", FIRM: "FIRM", PLUS: "FIRM_PLUS" };
export const productForFirmPlan = (plan: FirmPlan): BillingProduct => FIRM_PRODUCTS[plan];
export const firmPlanForProduct = (p: BillingProduct): FirmPlan | null => (p === "FIRM_SOLO" ? "SOLO" : p === "FIRM" ? "FIRM" : p === "FIRM_PLUS" ? "PLUS" : null);

export function lookupKeyFor(product: BillingProduct, interval: "month" | "year"): LookupKey | null {
  const hit = (Object.keys(CATALOG) as LookupKey[]).find((k) => CATALOG[k].product === product && CATALOG[k].interval === interval);
  return hit ?? null;
}
export const isLookupKey = (k: string | null | undefined): k is LookupKey => Boolean(k && k in CATALOG);

/** Webhook events the app listens to (the setup script registers exactly these). */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.upcoming",
] as const;
