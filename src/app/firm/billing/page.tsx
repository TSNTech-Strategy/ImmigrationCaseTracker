import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutButton, PortalButton } from "@/app/billing/buttons";
import { requireUser } from "@/lib/auth/session";
import { billingEnabled, billingService, billingTestMode } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { firmService } from "@/lib/firms";
import { TRIAL_CASE_LIMIT } from "@/lib/firms/service";
import { FIRM_PLANS, FOUNDING_FIRM_OFFER, formatUsd } from "@/lib/plans";

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

  const planCard = (key: "SOLO" | "FIRM") => {
    const p = FIRM_PLANS[key];
    const current = firm.plan === key;
    const tooSmall = key === "SOLO" && (members > (p.maxUsers ?? Infinity) || cases > p.maxCases);
    return (
      <li key={key} className={`flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-5 ${current ? "border-2 border-[var(--accent)]" : "border-[var(--border)]"}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{p.label}</h3>
          {current && <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-fg)]">Current plan</span>}
        </div>
        <p>
          <span className="text-2xl font-semibold">{formatUsd(p.price)}</span>
          <span className="text-[var(--muted)]">/month</span>
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          <li>✓ Up to {p.maxCases} client cases</li>
          <li>✓ {p.maxUsers ? `${p.maxUsers} team members` : "Unlimited team members"}</li>
        </ul>
        {enabled && isOwner && !firm.plan && (
          tooSmall ? (
            <p className="text-sm text-[var(--muted)]">Your firm has more people or cases than {p.label} includes.</p>
          ) : (
            <CheckoutButton fields={{ kind: "firm", plan: key }} secondary={key === "SOLO"}>
              Choose {p.label}
            </CheckoutButton>
          )
        )}
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
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

      <section aria-labelledby="status-h" className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="status-h" className="text-lg font-semibold">
          Your plan
        </h2>
        {firm.plan ? (
          <p>
            <strong>{FIRM_PLANS[firm.plan].label}</strong>: {cases} of {firm.caseLimit} cases, {members} team member{members === 1 ? "" : "s"}.
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
        <p className="rounded-xl border border-[var(--brand-red)] bg-[var(--surface)] px-4 py-3 text-sm">
          <strong>Founding firm offer:</strong> the first {FOUNDING_FIRM_OFFER.firms} firms get {FOUNDING_FIRM_OFFER.percentOff}% off for their first{" "}
          {FOUNDING_FIRM_OFFER.months} months. Applied automatically at checkout while places last.
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">{(["SOLO", "FIRM"] as const).map(planCard)}</ul>
      {!enabled && <p className="text-sm text-[var(--muted)]">Paid plans are coming soon.</p>}
      <p className="text-xs text-[var(--muted)]">
        Secure payment by Stripe. Sales tax is added where it applies; you can add your firm&apos;s tax ID at checkout. Cancel any time: your plan
        stays on until the end of the period you paid for.
      </p>
    </>
  );
}
