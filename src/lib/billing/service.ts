import type { BillingProduct, PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import type { EmailDriver } from "@/lib/email";
import { renewalReminderEmail } from "@/lib/email/templates";
import { findFirmContext } from "@/lib/firms/service";
import { CATALOG, FOUNDING_COUPON_ID, isLookupKey, lookupKeyFor, PRODUCTS, productForFirmPlan, type LookupKey } from "./catalog";
import { createEntitlements, isEntitled } from "./entitlements";

/**
 * Billing with Stripe Checkout (hosted payment page) and the Stripe customer
 * portal (cancel, change card or plan). Card details never reach CasePingo.
 *
 * Webhooks: every event is signature-checked by the route, processed once
 * (StripeEvent table), and the subscription is always re-read from the Stripe
 * API, so late or out-of-order events can't leave stale state.
 */

/** The slice of the Stripe client we use (the real client fits; tests pass a fake). */
export type StripePort = {
  customers: { create(p: Stripe.CustomerCreateParams): Promise<{ id: string }> };
  checkout: {
    sessions: {
      create(p: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }>;
      retrieve(id: string): Promise<Pick<Stripe.Checkout.Session, "customer" | "subscription" | "status">>;
    };
  };
  billingPortal: {
    sessions: { create(p: Stripe.BillingPortal.SessionCreateParams): Promise<{ url: string }> };
    configurations: { list(p?: Stripe.BillingPortal.ConfigurationListParams): Promise<{ data: Stripe.BillingPortal.Configuration[] }> };
  };
  subscriptions: {
    retrieve(id: string, p?: Stripe.SubscriptionRetrieveParams): Promise<Stripe.Subscription>;
    cancel(id: string, p?: Stripe.SubscriptionCancelParams): Promise<unknown>;
  };
  prices: { list(p?: Stripe.PriceListParams): Promise<{ data: Stripe.Price[] }> };
  coupons: { retrieve(id: string): Promise<Stripe.Coupon> };
};

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export type CheckoutChoice =
  | { kind: "premium"; interval: "month" | "year" }
  | { kind: "firm"; plan: "SOLO" | "FIRM" };

const PLAN_NAMES: Record<BillingProduct, string> = { PREMIUM: "Premium", FIRM_SOLO: "Firm Solo", FIRM: "Firm" };
const usd = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export type BillingDeps = {
  db: PrismaClient;
  stripe: StripePort;
  mailer: EmailDriver;
  siteUrl: string;
  automaticTax?: boolean;
  now?: () => Date;
};

export function createBillingService({ db, stripe, mailer, siteUrl, automaticTax = true, now = () => new Date() }: BillingDeps) {
  const ent = createEntitlements({ db, now });
  const priceIds = new Map<LookupKey, { id: string; at: number }>();
  let portalConfig: { id: string | null; at: number } | null = null;

  async function priceId(key: LookupKey): Promise<string> {
    const hit = priceIds.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.id;
    const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
    if (!data[0]) throw new Error(`Stripe price "${key}" not found. Run npm run stripe:setup.`);
    priceIds.set(key, { id: data[0].id, at: Date.now() });
    return data[0].id;
  }

  /** The portal configuration created by stripe:setup (falls back to the account default). */
  async function portalConfiguration(): Promise<string | undefined> {
    if (portalConfig && Date.now() - portalConfig.at < 10 * 60_000) return portalConfig.id ?? undefined;
    const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
    const ours = data.find((c) => c.metadata?.casepingo === "true");
    portalConfig = { id: ours?.id ?? null, at: Date.now() };
    return ours?.id;
  }

  async function foundingDiscount(): Promise<Stripe.Checkout.SessionCreateParams.Discount[] | undefined> {
    try {
      const c = await stripe.coupons.retrieve(FOUNDING_COUPON_ID);
      if (!c.valid) return undefined;
      if (c.max_redemptions !== null && c.max_redemptions !== undefined && c.times_redeemed >= c.max_redemptions) return undefined;
      return [{ coupon: c.id }];
    } catch {
      return undefined; // offer over or coupon missing: full price
    }
  }

  /** Who is buying, their Stripe customer, and any subscription they already have. */
  async function payer(userId: string, choice: CheckoutChoice) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, stripeCustomerId: true } });
    if (!user) return fail("Account not found.");
    if (choice.kind === "premium") {
      const owner: Record<string, string> = { casepingoUserId: user.id };
      return { ok: true as const, user, firm: null, customerId: user.stripeCustomerId, owner };
    }
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (ctx.membership.role !== "OWNER") return fail("Only a firm Owner can manage billing.");
    const owner: Record<string, string> = { casepingoFirmId: ctx.firm.id };
    return { ok: true as const, user, firm: ctx.firm, customerId: ctx.firm.stripeCustomerId, owner };
  }

  async function ensureCustomer(p: Exclude<Awaited<ReturnType<typeof payer>>, Fail>): Promise<string> {
    if (p.customerId) return p.customerId;
    const c = await stripe.customers.create({
      email: p.user.email,
      name: p.firm?.name ?? p.user.name ?? undefined,
      metadata: p.owner,
    });
    // Two clicks at once: keep whichever customer was saved first.
    if (p.firm) {
      await db.firm.updateMany({ where: { id: p.firm.id, stripeCustomerId: null }, data: { stripeCustomerId: c.id } });
      return (await db.firm.findUniqueOrThrow({ where: { id: p.firm.id } })).stripeCustomerId!;
    }
    await db.user.updateMany({ where: { id: p.user.id, stripeCustomerId: null }, data: { stripeCustomerId: c.id } });
    return (await db.user.findUniqueOrThrow({ where: { id: p.user.id } })).stripeCustomerId!;
  }

  /** Start Stripe Checkout, or send someone who already pays to the portal instead. */
  async function startCheckout(userId: string, choice: CheckoutChoice): Promise<{ ok: true; url: string } | Fail> {
    const p = await payer(userId, choice);
    if (!p.ok) return p;
    const t = now();
    const existing = await db.subscription.findMany({ where: p.firm ? { firmId: p.firm.id } : { userId: p.user.id, product: "PREMIUM" } });
    if (existing.some((s) => isEntitled(s, t))) return openPortal(userId, choice.kind === "firm" ? "firm" : "user");

    const product: BillingProduct = choice.kind === "premium" ? "PREMIUM" : productForFirmPlan(choice.plan);
    const key = lookupKeyFor(product, choice.kind === "premium" ? choice.interval : "month")!;
    const customer = await ensureCustomer(p);
    const back = choice.kind === "premium" ? `${siteUrl}/settings` : `${siteUrl}/firm/billing`;
    const discounts = choice.kind === "firm" ? await foundingDiscount() : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: p.firm?.id ?? p.user.id,
      line_items: [{ price: await priceId(key), quantity: 1 }],
      ...(discounts ? { discounts } : {}),
      automatic_tax: { enabled: automaticTax },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      ...(choice.kind === "firm" ? { tax_id_collection: { enabled: true } } : {}),
      subscription_data: { metadata: { ...p.owner, product } },
      metadata: { ...p.owner, product },
      success_url: `${back}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?billing=cancelled`,
    });
    if (!session.url) return fail("Stripe didn't return a checkout page. Please try again.");
    return { ok: true, url: session.url };
  }

  /**
   * Right after Checkout: sync the new subscription now instead of waiting
   * for the webhook, so the page already shows the new plan. Only for a
   * session that belongs to this person's (or their firm's) customer.
   */
  async function confirmCheckout(userId: string, sessionId: string) {
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { ok: false as const };
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const customer = typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);
    const sub = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
    if (!customer || !sub || s.status !== "complete") return { ok: false as const };
    const [user, ctx] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }),
      findFirmContext(db, userId),
    ]);
    if (customer !== user?.stripeCustomerId && customer !== ctx?.firm.stripeCustomerId) return { ok: false as const };
    await syncSubscription(sub);
    return { ok: true as const };
  }

  /** Stripe's customer portal: cancel, change card, switch plan, invoices. */
  async function openPortal(userId: string, scope: "user" | "firm"): Promise<{ ok: true; url: string } | Fail> {
    let customer: string | null;
    let back: string;
    if (scope === "firm") {
      const ctx = await findFirmContext(db, userId);
      if (!ctx) return fail("You're not part of a firm workspace.");
      if (ctx.membership.role !== "OWNER") return fail("Only a firm Owner can manage billing.");
      customer = ctx.firm.stripeCustomerId;
      back = `${siteUrl}/firm/billing`;
    } else {
      customer = (await db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }))?.stripeCustomerId ?? null;
      back = `${siteUrl}/settings`;
    }
    if (!customer) return fail("There's no billing account yet. Choose a plan first.");
    const configuration = await portalConfiguration();
    const s = await stripe.billingPortal.sessions.create({ customer, return_url: back, ...(configuration ? { configuration } : {}) });
    return { ok: true, url: s.url };
  }

  /** Mirror one subscription from Stripe and re-apply the owner's entitlements. */
  async function syncSubscription(subscriptionId: string) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
    const item = sub.items.data[0];
    const key = item?.price?.lookup_key;
    if (!item || !isLookupKey(key)) return { skipped: "not a CasePingo price" as const };
    const product = CATALOG[key].product as BillingProduct;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    // Owner: our own metadata first, then whoever holds this customer.
    let userId = sub.metadata?.casepingoUserId || null;
    let firmId = sub.metadata?.casepingoFirmId || null;
    if (!userId && !firmId) {
      const [u, f] = await Promise.all([
        db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }),
        db.firm.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } }),
      ]);
      firmId = product === "PREMIUM" ? null : (f?.id ?? null);
      userId = product === "PREMIUM" ? (u?.id ?? null) : null;
    }
    if (userId && !(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) userId = null;
    if (firmId && !(await db.firm.findUnique({ where: { id: firmId }, select: { id: true } }))) firmId = null;

    const prev = await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
    const t = now();
    const pastDueSince = sub.status === "past_due" ? (prev?.pastDueSince ?? t) : null;
    const data = {
      stripeCustomerId: customerId,
      userId: firmId ? null : userId,
      firmId,
      product,
      interval: CATALOG[key].interval,
      status: sub.status,
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
      pastDueSince,
    };
    await db.subscription.upsert({ where: { stripeSubscriptionId: sub.id }, create: { stripeSubscriptionId: sub.id, ...data }, update: data });
    // A subscription can move owner only if metadata was edited by hand; re-apply both sides.
    const owners = new Set([prev?.userId, data.userId].filter(Boolean) as string[]);
    const firms = new Set([prev?.firmId, data.firmId].filter(Boolean) as string[]);
    for (const u of owners) await ent.applyUser(u);
    for (const f of firms) await ent.applyFirm(f);
    return { synced: true as const, status: sub.status, product };
  }

  async function subscriptionIdOf(event: Stripe.Event): Promise<string | null> {
    const o = event.data.object as unknown as Record<string, unknown>;
    if (event.type.startsWith("customer.subscription.")) return String(o.id);
    if (event.type === "checkout.session.completed") {
      const s = o.subscription;
      return typeof s === "string" ? s : s && typeof s === "object" ? String((s as { id: string }).id) : null;
    }
    if (event.type.startsWith("invoice.")) {
      const inv = event.data.object as Stripe.Invoice;
      const s = inv.parent?.subscription_details?.subscription;
      return typeof s === "string" ? s : (s?.id ?? null);
    }
    return null;
  }

  async function sendRenewalReminder(invoice: Stripe.Invoice, subscriptionId: string) {
    const row = await db.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
    if (!row || row.interval !== "year" || row.cancelAtPeriodEnd) return { sent: 0 };
    let recipients: { email: string; name: string | null }[] = [];
    let manageUrl = `${siteUrl}/settings`;
    if (row.userId) {
      const u = await db.user.findUnique({ where: { id: row.userId }, select: { email: true, name: true } });
      if (u) recipients = [u];
    } else if (row.firmId) {
      manageUrl = `${siteUrl}/firm/billing`;
      const owners = await db.firmMembership.findMany({
        where: { firmId: row.firmId, role: "OWNER", revokedAt: null },
        select: { user: { select: { email: true, name: true } } },
      });
      recipients = owners.map((o) => o.user);
    }
    const renewsOn = invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : row.currentPeriodEnd;
    for (const r of recipients) {
      await mailer.send(
        renewalReminderEmail({
          to: r.email,
          name: r.name,
          planName: PLAN_NAMES[row.product],
          amount: usd(invoice.amount_due, invoice.currency),
          renewsOn,
          manageUrl,
        }),
      );
    }
    return { sent: recipients.length };
  }

  /**
   * Process one verified webhook event, at most once. Throws on failure so
   * the route answers 500 and Stripe retries (the event isn't marked done).
   */
  async function handleEvent(event: Stripe.Event): Promise<{ duplicate: true } | { duplicate: false; result: unknown }> {
    try {
      await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { duplicate: true };
      throw err;
    }
    try {
      const subId = await subscriptionIdOf(event);
      let result: unknown = { ignored: true };
      if (event.type === "invoice.upcoming") {
        result = subId ? await sendRenewalReminder(event.data.object as Stripe.Invoice, subId) : { sent: 0 };
      } else if (subId) {
        result = await syncSubscription(subId);
      }
      return { duplicate: false, result };
    } catch (err) {
      await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
      throw err;
    }
  }

  /** Account deletion: stop any Premium billing immediately (no further charges). */
  async function cancelForDeletedUser(userId: string) {
    const subs = await db.subscription.findMany({ where: { userId, status: { notIn: ["canceled", "incomplete_expired"] } } });
    for (const s of subs) {
      await stripe.subscriptions.cancel(s.stripeSubscriptionId);
      await db.subscription.update({ where: { id: s.id }, data: { status: "canceled", cancelAtPeriodEnd: false } });
    }
    return { canceled: subs.length };
  }

  /** Daily: apply the grace-period end for past-due subscriptions (no Stripe event marks it). */
  async function reconcilePastDue() {
    const t = now();
    const subs = await db.subscription.findMany({ where: { status: "past_due" }, select: { userId: true, firmId: true } });
    let applied = 0;
    for (const s of subs) {
      if (s.userId) await ent.applyUser(s.userId);
      if (s.firmId) await ent.applyFirm(s.firmId);
      applied++;
    }
    return { checked: applied, at: t.toISOString() };
  }

  /** What the Settings / Firm billing pages show. */
  async function summary(scope: { userId: string } | { firmId: string }) {
    const subs = await db.subscription.findMany({
      where: "userId" in scope ? { userId: scope.userId, product: "PREMIUM" } : { firmId: scope.firmId },
      orderBy: { updatedAt: "desc" },
    });
    const t = now();
    const current = subs.find((s) => isEntitled(s, t)) ?? null;
    return {
      current: current && {
        product: current.product,
        planName: PLAN_NAMES[current.product],
        interval: current.interval,
        status: current.status,
        renewsOrEndsOn: current.currentPeriodEnd,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        pastDue: current.status === "past_due",
      },
    };
  }

  return {
    startCheckout,
    confirmCheckout,
    openPortal,
    syncSubscription,
    handleEvent,
    cancelForDeletedUser,
    reconcilePastDue,
    summary,
    chooseCheckedCase: ent.chooseCheckedCase,
    products: PRODUCTS,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
