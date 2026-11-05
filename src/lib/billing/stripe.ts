import "server-only";
import Stripe from "stripe";

/**
 * The Stripe client, from server-only environment variables (never sent to
 * the browser). Billing is off when STRIPE_SECRET_KEY isn't set: paid plans
 * then show "Coming soon".
 */

let client: Stripe | null = null;

export function billingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

/** Test-mode keys (sk_test_ / rk_test_) charge nothing; the UI says so. */
export function billingTestMode(env: Record<string, string | undefined> = process.env): boolean {
  return /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY?.trim() ?? "");
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  // STRIPE_API_BASE points at a stand-in Stripe for local end-to-end tests. Never honoured on production.
  const base = process.env.VERCEL_ENV === "production" ? undefined : process.env.STRIPE_API_BASE?.trim();
  const local = base ? new URL(base) : null;
  client ??= new Stripe(key, {
    appInfo: { name: "CasePingo" },
    ...(local ? { host: local.hostname, port: Number(local.port), protocol: local.protocol.replace(":", "") as "http" | "https" } : {}),
  });
  return client;
}

/** Stripe Tax on Checkout (decided Nov 5, 2026). Set STRIPE_AUTOMATIC_TAX=off only if Stripe Tax isn't set up yet. */
export const automaticTaxEnabled = (env: Record<string, string | undefined> = process.env) => env.STRIPE_AUTOMATIC_TAX?.trim() !== "off";
