/** Billing against a real Postgres with a fake Stripe (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { protectReceipt } from "@/lib/cases/receipt-store";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { createFirmService } from "@/lib/firms/service";
import { findDueCaseIds } from "@/lib/jobs/scheduler";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { FOUNDING_COUPON_ID, type LookupKey } from "../catalog";
import { createBillingService, type StripePort } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("billing", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-07-01T12:00:00Z");
  const now = () => clock;
  const days = (n: number) => (clock = new Date(clock.getTime() + n * 86_400_000));
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const users: string[] = [];

  // ---- Fake Stripe ---------------------------------------------------------
  const subs = new Map<string, Stripe.Subscription>();
  const sessions = new Map<string, Pick<Stripe.Checkout.Session, "customer" | "subscription" | "status">>();
  const calls: { checkout: Stripe.Checkout.SessionCreateParams[]; customers: number; canceled: string[] } = { checkout: [], customers: 0, canceled: [] };
  let coupon: Partial<Stripe.Coupon> | null = { id: FOUNDING_COUPON_ID, valid: true, max_redemptions: 25, times_redeemed: 3 };
  const stripe: StripePort = {
    customers: { create: async () => ({ id: `cus_${++calls.customers}_${randomUUID().slice(0, 6)}` }) },
    checkout: {
      sessions: {
        create: async (p) => (calls.checkout.push(p), { url: "https://checkout.stripe.test/s" }),
        retrieve: async (id) => sessions.get(id) ?? { customer: null, subscription: null, status: "open" },
      },
    },
    billingPortal: {
      sessions: { create: async (p) => ({ url: `https://billing.stripe.test/p/${p.customer}` }) },
      configurations: { list: async () => ({ data: [{ id: "bpc_ours", metadata: { casepingo: "true" } } as unknown as Stripe.BillingPortal.Configuration] }) },
    },
    subscriptions: {
      retrieve: async (id) => {
        const s = subs.get(id);
        if (!s) throw new Error("no such subscription");
        return s;
      },
      cancel: async (id) => {
        calls.canceled.push(id);
        const s = subs.get(id);
        if (s) subs.set(id, { ...s, status: "canceled" });
        return {};
      },
    },
    prices: { list: async (p) => ({ data: [{ id: `price_${p?.lookup_keys?.[0]}` } as Stripe.Price] }) },
    coupons: {
      retrieve: async () => {
        if (!coupon) throw new Error("No such coupon");
        return coupon as Stripe.Coupon;
      },
    },
  };
  const billing = createBillingService({ db, stripe, mailer, siteUrl: "https://casepingo.test", now });

  const setSub = (id: string, o: { key: LookupKey; status: Stripe.Subscription.Status; customer: string; meta: Record<string, string>; cancel?: boolean }) =>
    subs.set(id, {
      id,
      status: o.status,
      customer: o.customer,
      metadata: o.meta,
      cancel_at_period_end: Boolean(o.cancel),
      cancel_at: null,
      items: { data: [{ price: { lookup_key: o.key }, current_period_end: Math.floor(clock.getTime() / 1000) + 30 * 86_400 }] },
    } as unknown as Stripe.Subscription);
  let n = 0;
  const event = (type: string, object: object) => ({ id: `evt_${++n}_${randomUUID().slice(0, 8)}`, type, data: { object } }) as unknown as Stripe.Event;
  const subEvent = (id: string, type = "customer.subscription.updated") => event(type, { id });

  const mkUser = async (plan: "FREE" | "PREMIUM" = "FREE") => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `b-${id}@test.dev`, name: "Billing Tester", plan } });
    users.push(id);
    return id;
  };
  const mkCase = (ownerUserId: string, receipt: string, createdAt: Date) =>
    db.trackedCase.create({
      data: { ...protectReceipt(receipt), ownerUserId, createdAt, consents: { create: { basis: "SELF", source: "WEB", statementVersion: "t" } } },
    });

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 4).toString("base64");
  });
  beforeEach(() => {
    sent.length = 0;
    calls.checkout.length = 0;
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.subscription.deleteMany({ where: { OR: [{ userId: { in: users } }, { userId: null, firmId: null }] } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("starts Premium checkout with one Stripe customer, the right price, Stripe Tax and our metadata", async () => {
    const u = await mkUser();
    const r = await billing.startCheckout(u, { kind: "premium", interval: "year" });
    expect(r).toEqual({ ok: true, url: "https://checkout.stripe.test/s" });
    const p = calls.checkout[0];
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_casepingo_premium_year", quantity: 1 }]);
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.subscription_data?.metadata).toMatchObject({ casepingoUserId: u, product: "PREMIUM" });
    expect(p.discounts).toBeUndefined(); // the founding offer is for firms only
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId;
    expect(cus).toMatch(/^cus_/);
    await billing.startCheckout(u, { kind: "premium", interval: "month" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId).toBe(cus);
  });

  it("upgrades on payment, keeps access through a 7-day grace period, then drops to Free keeping one case checked", async () => {
    const u = await mkUser();
    await billing.startCheckout(u, { kind: "premium", interval: "month" });
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId!;
    setSub("sub_p1", { key: "casepingo_premium_month", status: "active", customer: cus, meta: { casepingoUserId: u } });
    const e = event("checkout.session.completed", { subscription: "sub_p1" });
    expect(await billing.handleEvent(e)).toMatchObject({ duplicate: false });
    expect(await billing.handleEvent(e)).toEqual({ duplicate: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("PREMIUM");

    const base = clock.getTime();
    const cases = [];
    for (const [i, r] of ["EAC9999103402", "EAC9999103403", "IOE0000000001"].entries()) cases.push(await mkCase(u, r, new Date(base + i * 1000)));

    // Already paying: a second checkout sends them to the portal instead.
    expect(await billing.startCheckout(u, { kind: "premium", interval: "year" })).toMatchObject({ ok: true, url: expect.stringContaining("billing.stripe.test") });

    setSub("sub_p1", { key: "casepingo_premium_month", status: "past_due", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(event("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_p1" } } }));
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("PREMIUM");
    days(8);
    await billing.reconcilePastDue();
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("FREE");
    const after = await db.trackedCase.findMany({ where: { ownerUserId: u }, orderBy: { createdAt: "asc" } });
    expect(after.map((c) => [c.trackingStatus, c.pausedReason])).toEqual([["ACTIVE", null], ["PAUSED", "plan_limit"], ["PAUSED", "plan_limit"]]);
    expect(await findDueCaseIds(db, clock)).not.toContain(after[1].id);
    expect(await db.auditLog.count({ where: { targetId: u, action: "plan.changed" } })).toBe(2);

    // Free: choose a different case to keep checked.
    expect(await billing.chooseCheckedCase(u, after[2].id)).toEqual({ ok: true });
    const swapped = await db.trackedCase.findMany({ where: { ownerUserId: u }, orderBy: { createdAt: "asc" } });
    expect(swapped.map((c) => c.trackingStatus)).toEqual(["PAUSED", "PAUSED", "ACTIVE"]);
    expect(await billing.chooseCheckedCase(u, swapped[2].id)).toMatchObject({ ok: false }); // already checked

    // Pays again: everything resumes.
    setSub("sub_p1", { key: "casepingo_premium_month", status: "active", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(event("invoice.paid", { parent: { subscription_details: { subscription: "sub_p1" } } }));
    const resumed = await db.trackedCase.findMany({ where: { ownerUserId: u } });
    expect(resumed.every((c) => c.trackingStatus === "ACTIVE" && c.pausedReason === null)).toBe(true);
  });

  it("cancel at period end keeps Premium until Stripe ends it; a failed event is retried, not lost", async () => {
    const u = await mkUser();
    await billing.startCheckout(u, { kind: "premium", interval: "year" });
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId!;
    setSub("sub_p2", { key: "casepingo_premium_year", status: "active", customer: cus, meta: { casepingoUserId: u }, cancel: true });
    await billing.handleEvent(subEvent("sub_p2", "customer.subscription.created"));
    expect(await billing.summary({ userId: u })).toMatchObject({ current: { planName: "Premium", interval: "year", cancelAtPeriodEnd: true } });
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("PREMIUM");

    const e = subEvent("sub_missing");
    await expect(billing.handleEvent(e)).rejects.toThrow();
    expect(await db.stripeEvent.count({ where: { id: e.id } })).toBe(0); // Stripe's retry will be processed

    setSub("sub_p2", { key: "casepingo_premium_year", status: "canceled", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(subEvent("sub_p2", "customer.subscription.deleted"));
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("FREE");
  });

  it("emails a reminder before yearly renewals only", async () => {
    const u = await mkUser();
    await billing.startCheckout(u, { kind: "premium", interval: "year" });
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId!;
    setSub("sub_y", { key: "casepingo_premium_year", status: "active", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(subEvent("sub_y"));
    const inv = (sub: string) => ({ amount_due: 2900, currency: "usd", next_payment_attempt: Math.floor(clock.getTime() / 1000) + 7 * 86_400, parent: { subscription_details: { subscription: sub } } });
    await billing.handleEvent(event("invoice.upcoming", inv("sub_y")));
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Premium plan renews on");
    expect(sent[0].body).toContain("$29.00");
    expect(sent[0].body).toContain("https://casepingo.test/settings");

    setSub("sub_m", { key: "casepingo_premium_month", status: "active", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(subEvent("sub_m"));
    await billing.handleEvent(event("invoice.upcoming", inv("sub_m")));
    expect(sent).toHaveLength(1);
  });

  it("firms: Owner-only checkout with the founding offer while it lasts; plan sets limits; Solo caps the team at 2", async () => {
    const owner = await mkUser();
    const admin = await mkUser();
    const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
    const f = await firms.createFirm(owner, "Billing Firm");
    if (!f.ok) throw new Error();
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: admin, role: "ADMIN" } });

    expect(await billing.startCheckout(admin, { kind: "firm", plan: "SOLO" })).toMatchObject({ ok: false, error: expect.stringMatching(/Owner/) });
    expect(await billing.startCheckout(owner, { kind: "firm", plan: "SOLO" })).toMatchObject({ ok: true });
    expect(calls.checkout[0].discounts).toEqual([{ coupon: FOUNDING_COUPON_ID }]);
    expect(calls.checkout[0].line_items).toEqual([{ price: "price_casepingo_firm_solo_month", quantity: 1 }]);
    coupon = { id: FOUNDING_COUPON_ID, valid: true, max_redemptions: 25, times_redeemed: 25 };
    await billing.startCheckout(owner, { kind: "firm", plan: "FIRM" });
    expect(calls.checkout[1].discounts).toBeUndefined();
    // Yearly billing and the Firm Plus plan.
    await billing.startCheckout(owner, { kind: "firm", plan: "PLUS", interval: "year" });
    expect(calls.checkout[2].line_items).toEqual([{ price: "price_casepingo_firm_plus_year", quantity: 1 }]);

    const cus = (await db.firm.findUniqueOrThrow({ where: { id: f.firm.id } })).stripeCustomerId!;
    setSub("sub_f1", { key: "casepingo_firm_solo_month", status: "active", customer: cus, meta: { casepingoFirmId: f.firm.id } });
    await billing.handleEvent(subEvent("sub_f1", "customer.subscription.created"));
    expect(await db.firm.findUniqueOrThrow({ where: { id: f.firm.id } })).toMatchObject({ plan: "SOLO", caseLimit: 150 });
    expect(await firms.invite(owner, "third@test.dev", "STAFF")).toMatchObject({ ok: false, error: expect.stringMatching(/2 team members/) });

    setSub("sub_f1", { key: "casepingo_firm_month", status: "active", customer: cus, meta: { casepingoFirmId: f.firm.id } });
    await billing.handleEvent(subEvent("sub_f1"));
    expect(await db.firm.findUniqueOrThrow({ where: { id: f.firm.id } })).toMatchObject({ plan: "FIRM", caseLimit: 600 });
    expect(await firms.invite(owner, "third@test.dev", "STAFF")).toMatchObject({ ok: true });

    setSub("sub_f1", { key: "casepingo_firm_plus_year", status: "active", customer: cus, meta: { casepingoFirmId: f.firm.id } });
    await billing.handleEvent(subEvent("sub_f1"));
    expect(await db.firm.findUniqueOrThrow({ where: { id: f.firm.id } })).toMatchObject({ plan: "PLUS", caseLimit: 2000 });
    coupon = { id: FOUNDING_COUPON_ID, valid: true, max_redemptions: 25, times_redeemed: 3 };
  });

  it("firms: after the trial, checks stop until the firm subscribes", async () => {
    const owner = await mkUser();
    const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
    const f = await firms.createFirm(owner, "Trial Firm");
    if (!f.ok) throw new Error();
    const c = await db.trackedCase.create({
      data: { ...protectReceipt("EAC9999103402"), firmId: f.firm.id, consents: { create: { basis: "LEGAL_REPRESENTATIVE", source: "FIRM_ATTESTATION", statementVersion: "t" } } },
    });
    expect(await findDueCaseIds(db, clock)).toContain(c.id);
    days(15);
    expect(await findDueCaseIds(db, clock)).not.toContain(c.id);
    const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
    const cases = createCaseService({ db, uscis, now, env: {} });
    expect(await cases.runCheck(await db.trackedCase.findUniqueOrThrow({ where: { id: c.id } }), "MANUAL")).toMatchObject({ status: "paused" });

    await billing.startCheckout(owner, { kind: "firm", plan: "FIRM" });
    const cus = (await db.firm.findUniqueOrThrow({ where: { id: f.firm.id } })).stripeCustomerId!;
    setSub("sub_f2", { key: "casepingo_firm_month", status: "active", customer: cus, meta: { casepingoFirmId: f.firm.id } });
    await billing.handleEvent(subEvent("sub_f2", "customer.subscription.created"));
    expect(await findDueCaseIds(db, clock)).toContain(c.id);
  });

  it("confirms a finished checkout right away, only for the buyer's own customer", async () => {
    const u = await mkUser();
    const other = await mkUser();
    await billing.startCheckout(u, { kind: "premium", interval: "month" });
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId!;
    setSub("sub_conf", { key: "casepingo_premium_month", status: "active", customer: cus, meta: { casepingoUserId: u } });
    sessions.set("cs_test_1", { customer: cus, subscription: "sub_conf", status: "complete" });
    expect(await billing.confirmCheckout(other, "cs_test_1")).toEqual({ ok: false });
    expect(await billing.confirmCheckout(u, "not a session")).toEqual({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("FREE");
    expect(await billing.confirmCheckout(u, "cs_test_1")).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).plan).toBe("PREMIUM");
  });

  it("cancels Premium billing when the account is deleted", async () => {
    const u = await mkUser();
    await billing.startCheckout(u, { kind: "premium", interval: "month" });
    const cus = (await db.user.findUniqueOrThrow({ where: { id: u } })).stripeCustomerId!;
    setSub("sub_del", { key: "casepingo_premium_month", status: "active", customer: cus, meta: { casepingoUserId: u } });
    await billing.handleEvent(subEvent("sub_del"));
    expect(await billing.cancelForDeletedUser(u)).toEqual({ canceled: 1 });
    expect(calls.canceled).toContain("sub_del");
    expect(await billing.cancelForDeletedUser(u)).toEqual({ canceled: 0 });
  });
});
