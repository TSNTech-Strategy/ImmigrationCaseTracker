/**
 * One-time (and safe to re-run) Stripe setup for CasePingo.
 *
 *   npm run stripe:setup                                  # uses https://casepingo.com
 *   npm run stripe:setup -- --site https://example.com    # another address
 *   npm run stripe:setup -- --new-webhook-secret          # replace the webhook and print a new secret
 *
 * Reads STRIPE_SECRET_KEY from your local .env (never committed). Use the
 * CasePingo Stripe account, in test mode first (sk_test_...).
 *
 * Creates or updates, from src/lib/billing/catalog.ts and src/lib/plans.ts:
 * - the 3 products and 4 prices (found by lookup key, so no price IDs to copy)
 * - the founding-firm coupon (50% off for 12 months, first 25 firms)
 * - the customer portal (two-click cancel at period end, card and plan changes)
 * - the webhook endpoint for /api/stripe/webhook, printing its signing secret once
 */
import Stripe from "stripe";
import { CATALOG, FOUNDING_COUPON_ID, PRODUCTS, WEBHOOK_EVENTS, type LookupKey } from "@/lib/billing/catalog";
import { FOUNDING_FIRM_OFFER } from "@/lib/plans";

const args = process.argv.slice(2);
const siteArg = args.indexOf("--site");
const site = new URL(siteArg >= 0 ? args[siteArg + 1] : "https://casepingo.com").origin;
const newSecret = args.includes("--new-webhook-secret");

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Add STRIPE_SECRET_KEY to your .env first (Stripe → Developers → API keys, CasePingo account).");
  process.exit(1);
}
const stripe = new Stripe(key, { appInfo: { name: "CasePingo setup" } });
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");

async function ensureProducts() {
  for (const p of Object.values(PRODUCTS)) {
    try {
      await stripe.products.update(p.id, { name: p.name, description: p.description, tax_code: p.taxCode, metadata: { casepingo: "true" } });
      console.log(`  product ${p.id}: up to date`);
    } catch (err) {
      if ((err as { code?: string }).code !== "resource_missing") throw err;
      await stripe.products.create({ id: p.id, name: p.name, description: p.description, tax_code: p.taxCode, metadata: { casepingo: "true" } });
      console.log(`  product ${p.id}: created`);
    }
  }
}

async function ensurePrices() {
  const keys = Object.keys(CATALOG) as LookupKey[];
  const { data } = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 20 });
  for (const k of keys) {
    const want = CATALOG[k];
    const cents = Math.round(want.amount * 100);
    const have = data.find((p) => p.lookup_key === k);
    if (have && have.unit_amount === cents && have.recurring?.interval === want.interval && have.currency === "usd") {
      console.log(`  price ${k}: $${want.amount}/${want.interval}, up to date`);
      continue;
    }
    // Prices can't be edited in Stripe: create the new one, move the lookup key, archive the old one.
    // Existing subscribers keep their old price until they change plan.
    await stripe.prices.create({
      product: PRODUCTS[want.product].id,
      currency: "usd",
      unit_amount: cents,
      recurring: { interval: want.interval },
      tax_behavior: "exclusive",
      lookup_key: k,
      transfer_lookup_key: true,
      metadata: { casepingo: "true" },
    });
    if (have) await stripe.prices.update(have.id, { active: false });
    console.log(`  price ${k}: $${want.amount}/${want.interval}, ${have ? "updated" : "created"}`);
  }
}

async function ensureCoupon() {
  try {
    const c = await stripe.coupons.retrieve(FOUNDING_COUPON_ID);
    console.log(`  founding-firm coupon: exists (${c.times_redeemed}/${c.max_redemptions ?? "∞"} used)`);
  } catch (err) {
    if ((err as { code?: string }).code !== "resource_missing") throw err;
    await stripe.coupons.create({
      id: FOUNDING_COUPON_ID,
      name: `Founding firm: ${FOUNDING_FIRM_OFFER.percentOff}% off for ${FOUNDING_FIRM_OFFER.months} months`,
      percent_off: FOUNDING_FIRM_OFFER.percentOff,
      duration: "repeating",
      duration_in_months: FOUNDING_FIRM_OFFER.months,
      max_redemptions: FOUNDING_FIRM_OFFER.firms,
      applies_to: { products: [PRODUCTS.FIRM_SOLO.id, PRODUCTS.FIRM.id] },
    });
    console.log("  founding-firm coupon: created");
  }
}

async function ensurePortal() {
  const prices = (await stripe.prices.list({ lookup_keys: Object.keys(CATALOG), active: true, limit: 20 })).data;
  const ids = (product: string) => prices.filter((p) => p.product === product).map((p) => p.id);
  const config: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: "CasePingo: manage your plan",
      privacy_policy_url: `${site}/privacy`,
      terms_of_service_url: `${site}/terms`,
    },
    default_return_url: `${site}/settings`,
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // The billing promise: cancel in two clicks, keep the plan until the paid period ends.
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "other"] } },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [
          { product: PRODUCTS.PREMIUM.id, prices: ids(PRODUCTS.PREMIUM.id) },
          { product: PRODUCTS.FIRM_SOLO.id, prices: ids(PRODUCTS.FIRM_SOLO.id) },
          { product: PRODUCTS.FIRM.id, prices: ids(PRODUCTS.FIRM.id) },
        ],
      },
    },
    metadata: { casepingo: "true" },
  };
  const existing = (await stripe.billingPortal.configurations.list({ active: true, limit: 20 })).data.find((c) => c.metadata?.casepingo === "true");
  if (existing) {
    await stripe.billingPortal.configurations.update(existing.id, config);
    console.log("  customer portal: updated");
  } else {
    await stripe.billingPortal.configurations.create(config);
    console.log("  customer portal: created");
  }
}

async function ensureWebhook() {
  const url = `${site}/api/stripe/webhook`;
  const all = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((w) => w.url === url);
  if (all.length && !newSecret) {
    for (const w of all) await stripe.webhookEndpoints.update(w.id, { enabled_events: [...WEBHOOK_EVENTS] });
    console.log(`  webhook ${url}: up to date (its secret is unchanged; use --new-webhook-secret to replace it)`);
    return null;
  }
  for (const w of all) await stripe.webhookEndpoints.del(w.id);
  const created = await stripe.webhookEndpoints.create({ url, enabled_events: [...WEBHOOK_EVENTS], description: "CasePingo billing" });
  console.log(`  webhook ${url}: created`);
  return created.secret ?? null;
}

async function taxStatus() {
  try {
    const s = await stripe.tax.settings.retrieve();
    return s.status;
  } catch {
    return "unknown";
  }
}

(async () => {
  console.log(`\nCasePingo Stripe setup (${live ? "LIVE mode: real charges" : "test mode: no real charges"}) for ${site}\n`);
  await ensureProducts();
  await ensurePrices();
  await ensureCoupon();
  await ensurePortal();
  const secret = await ensureWebhook();
  const tax = await taxStatus();

  console.log("\nDone.");
  if (secret) {
    console.log("\nAdd this to Vercel → casepingo → Settings → Environment Variables (Production), then redeploy:");
    console.log(`  STRIPE_WEBHOOK_SECRET = ${secret}`);
    console.log("It is shown only once. Don't paste it into chat or commit it.");
  }
  if (tax !== "active") {
    console.log(`\nStripe Tax is not active yet (status: ${tax}). In Stripe: Tax → Get started, add your business address,`);
    console.log("and add a registration for each state where you collect tax. Checkout needs this before it can charge tax.");
  }
  console.log("\nIn Stripe → Settings → Billing → Subscriptions and emails, set \"Upcoming renewal events\" to 7 days");
  console.log("(CasePingo emails its own reminder before yearly renewals when that event arrives).\n");
})().catch((err) => {
  console.error("\nSetup failed:", (err as Error).message);
  process.exit(1);
});
