import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutButton, PortalButton } from "@/app/billing/buttons";
import { requireUser } from "@/lib/auth/session";
import { billingEnabled, billingService, billingTestMode } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { firmService } from "@/lib/firms";
import { TRIAL_CASE_LIMIT } from "@/lib/firms/service";
import { FIRM_PLAN_ORDER, FIRM_PLANS, FOUNDING_FIRM_OFFER, formatUsd } from "@/lib/plans";

export const metadata: Metadata = { title: "Firm billing · CasePingo" };

const day = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function FirmBillingPage({ searchParams }: PageProps<"/firm/billing">) {
  const user = await requireUser("/firm/billing");
  let ctx = await firmService().getContext(user.id);
  if (!ctx || ctx.membership.role === "STAFF") redirect("/firm");
  const sp = await searchParams;
  const isOwner = ctx.membership.role === "OWNER";
  const enabled = billingEnabled();

  if (enabled && sp.billing === "success" && typeof sp.session_id === "string" && isOwner) {
    try {
      await billingService().confirmCheckout(user.id, sp.session_id);
      ctx = (await firmService().getContext(user.id)) ?? ctx;
    } catch {
      /* the webhook will finish it */
    }
  }
  const firm = ctx.firm;
  const now = new Date();
  const sub = enabled ? (await billingService().summary({ firmId: firm.id })).current : null;
  const [members, cases] = await Promise.all([
    prisma.firmMembership.count({ where: { firmId: firm.id, revokedAt: null } }),
    prisma.trackedCase.count({ where: { firmId: firm.id } }),
  ]);
  const trialDays = firm.trialEndsAt ? Math.ceil((firm.trialEndsAt.getTime() - now.getTime()) / 86_400_000) : 0;

  const yearly = sp.interval === "year";
  const order = FIRM_PLAN_ORDER;
  const planCard = (key: (typeof FIRM_PLAN_ORDER)[number]) => {
    const p = FIRM_PLANS[key];
    const current = firm.plan === key;
    const tooSmall = members > (p.maxUsers ?? Infinity) || cases > p.maxCases;
    return (
      <li key={key} className={`flex flex-col gap-3 rounded-lg border bg-[var(--surface)] p-5 ${current ? "border-2 border-[var(--accent)]" : key === "FIRM" ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{p.label}</h3>
          {current ? (
            <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-fg)]">Current plan</span>
          ) : (
            key === "FIRM" && <span className="rounded-full border border-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">Most firms</span>
          )}
        </div>
        <p className="text-sm text-[var(--muted)]">{p.for}</p>
        <p>
          <span className="text-2xl font-semibold">{formatUsd(yearly ? p.yearly : p.price)}</span>
          <span className="text-[var(--muted)]">{yearly ? "/year" : "/month"}</span>
          {yearly && <span className="block text-xs text-[var(--muted)]">{formatUsd(Math.round((p.yearly / 12) * 100) / 100)} a month, 2 months free</span>}
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {[`Up to ${p.maxCases.toLocaleString("en-US")} client cases`, p.maxUsers ? `${p.maxUsers} team members` : "Unlimited team members", "Every workspace feature"].map((f) => (
            <li key={f} className="flex items-start gap-2">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="m5 12 5 5 9-10" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          {enabled && isOwner && !firm.plan && (
            tooSmall ? (
              <p className="text-sm text-[var(--muted)]">Your firm has more people or cases than {p.label} includes.</p>
            ) : (
              <CheckoutButton fields={{ kind: "firm", plan: key, interval: yearly ? "year" : "month" }} secondary={key !== "FIRM"}>
                Choose {p.label}
              </CheckoutButton>
            )
          )}
        </div>
      </li>
    );
  };
  const limit = firm.plan ? FIRM_PLANS[firm.plan] : null;
  const usage = [
    { label: "Cases", used: cases, max: firm.plan ? firm.caseLimit : TRIAL_CASE_LIMIT },
    { label: "Team members", used: members, max: limit ? limit.maxUsers : null },
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Plan &amp; billing</h1>
        <p className="text-sm text-[var(--muted)]">{firm.name}</p>
      </div>
      {enabled && billingTestMode() && (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
          Test mode: payments use Stripe test cards and no real money is charged.
        </p>
      )}
      {sp.billing === "success" && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {firm.plan ? `Thank you! ${FIRM_PLANS[firm.plan].label} is active.` : "Payment received. Your plan will update within a minute."}
        </p>
      )}
      {sp.billing === "cancelled" && <p className="text-sm text-[var(--muted)]">Checkout was cancelled. You haven&apos;t been charged.</p>}

      <section aria-labelledby="status-h" className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="status-h" className="text-lg font-semibold">
          Your plan
        </h2>
        {firm.plan ? (
          <p>
            <strong>{FIRM_PLANS[firm.plan].label}</strong>
            {sub ? `, billed ${sub.interval === "year" ? "yearly" : "monthly"}` : ""}
          </p>
        ) : trialDays > 0 ? (
          <p>
            <strong>Free trial</strong>: {trialDays} day{trialDays === 1 ? "" : "s"} left, up to {TRIAL_CASE_LIMIT} cases.
          </p>
        ) : (
          <p className="text-[var(--danger)]">
            Your free trial has ended, so your firm&apos;s cases aren&apos;t being checked. Choose a plan to turn checks back on. Nothing has been
            deleted.
          </p>
        )}
        <dl className="grid gap-4 py-1 sm:grid-cols-2">
          {usage.map((u) => {
            const pct = u.max ? Math.min(100, Math.round((u.used / u.max) * 100)) : 0;
            return (
              <div key={u.label} className="flex flex-col gap-1.5">
                <dt className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">{u.label}</span>
                  <span className="font-medium tabular-nums">
                    {u.used.toLocaleString("en-US")} {u.max ? `of ${u.max.toLocaleString("en-US")}` : "(no limit)"}
                  </span>
                </dt>
                <dd>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={`${u.label}: ${u.used} of ${u.max ?? "unlimited"}`}>
                    <div className={`h-full rounded-full ${pct >= 90 ? "bg-[var(--danger)]" : pct >= 75 ? "bg-[var(--st-action)]" : "bg-[var(--accent)]"}`} style={{ width: `${u.max ? Math.max(pct, u.used ? 2 : 0) : 0}%` }} />
                  </div>
                </dd>
              </div>
            );
          })}
        </dl>
        {sub && (
          <p className="text-sm">
            {sub.pastDue
              ? "The last payment didn't go through. Update the card to keep your plan."
              : sub.cancelAtPeriodEnd
                ? `Cancelled. Your plan stays on until ${day(sub.renewsOrEndsOn)}.`
                : `Renews on ${day(sub.renewsOrEndsOn)}.`}
          </p>
        )}
        {enabled && isOwner && (firm.plan || firm.stripeCustomerId) && (
          <div>
            <PortalButton scope="firm">{firm.plan ? "Manage billing, switch plan or cancel" : "Billing history"}</PortalButton>
          </div>
        )}
        {!isOwner && <p className="text-sm text-[var(--muted)]">Only a firm Owner can change the plan or payment details.</p>}
      </section>

      {!firm.plan && (
        <p className="rounded-lg border border-[var(--brand-red)] bg-[var(--surface)] px-4 py-3 text-sm">
          <strong>Founding firm offer:</strong> the first {FOUNDING_FIRM_OFFER.firms} firms get {FOUNDING_FIRM_OFFER.percentOff}% off for their first{" "}
          {FOUNDING_FIRM_OFFER.months} months. Applied automatically at checkout while places last.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{firm.plan ? "All plans" : "Choose a plan"}</h2>
        <nav aria-label="Billing period" className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 text-sm">
          {[
            ["month", "Monthly"],
            ["year", "Yearly (2 months free)"],
          ].map(([v, l]) => (
            <Link
              key={v}
              href={v === "year" ? "/firm/billing?interval=year" : "/firm/billing"}
              aria-current={(v === "year") === yearly ? "page" : undefined}
              className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]"
            >
              {l}
            </Link>
          ))}
        </nav>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">{order.map(planCard)}</ul>
      <p className="text-sm text-[var(--muted)]">Price per firm, not per person: everyone on your team is included up to the plan&apos;s limit. Need more than {FIRM_PLANS.PLUS.maxCases.toLocaleString("en-US")} cases? Write to us.</p>
      {!enabled && <p className="text-sm text-[var(--muted)]">Paid plans are coming soon.</p>}
      <p className="text-xs text-[var(--muted)]">
        Secure payment by Stripe. Sales tax is added where it applies; you can add your firm&apos;s tax ID at checkout. Cancel any time: your plan
        stays on until the end of the period you paid for.
      </p>
    </div>
  );
}
