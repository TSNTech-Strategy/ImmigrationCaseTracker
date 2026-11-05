import type { Plan } from "@prisma/client";
import { CheckoutButton, PortalButton } from "@/app/billing/buttons";
import { billingEnabled, billingService, billingTestMode } from "@/lib/billing";
import { PLAN_LIMITS, PRICES, describeCadence, formatUsd, perMonth } from "@/lib/plans";
import { prisma } from "@/lib/db";

const day = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Settings → Plan: what you have, and how to upgrade, cancel or manage billing. */
export async function PlanSection({ userId, plan: planIn, billing, sessionId }: { userId: string; plan: Plan; billing?: string; sessionId?: string }) {
  const enabled = billingEnabled();
  let plan = planIn;
  let confirmNote: string | null = null;
  if (enabled && billing === "success" && sessionId) {
    try {
      const r = await billingService().confirmCheckout(userId, sessionId);
      if (r.ok) plan = (await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }))?.plan ?? plan;
    } catch {
      confirmNote = "Payment received. Your plan will update within a minute; refresh this page if it hasn't.";
    }
  }
  const summary = enabled ? await billingService().summary({ userId }) : { current: null };
  const sub = summary.current;
  const paused = await prisma.trackedCase.count({ where: { ownerUserId: userId, pausedReason: "plan_limit" } });
  const hasCustomer = Boolean((await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }))?.stripeCustomerId);

  return (
    <div className="flex flex-col gap-4">
      {enabled && billingTestMode() && (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
          Test mode: payments use Stripe test cards and no real money is charged.
        </p>
      )}
      {billing === "success" && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {confirmNote ?? (plan === "PREMIUM" ? "Thank you! Premium is on." : "Payment received. Your plan will update within a minute.")}
        </p>
      )}
      {billing === "cancelled" && <p className="text-sm text-[var(--muted)]">Checkout was cancelled. You haven&apos;t been charged.</p>}

      <p>
        <strong>{PLAN_LIMITS[plan].label}</strong>: up to {PLAN_LIMITS[plan].maxCases} {PLAN_LIMITS[plan].maxCases === 1 ? "case" : "cases"}, checked{" "}
        {describeCadence(plan)}.
      </p>
      {sub && (
        <p className="text-sm">
          {sub.pastDue ? (
            <span className="text-[var(--danger)]">Your last payment didn&apos;t go through. Update your card to keep Premium.</span>
          ) : sub.cancelAtPeriodEnd ? (
            <>Cancelled. Premium stays on until {day(sub.renewsOrEndsOn)}, then your account moves to Free. Your cases and history stay.</>
          ) : (
            <>
              Billed {sub.interval === "year" ? "yearly" : "monthly"}. Renews on {day(sub.renewsOrEndsOn)}
              {sub.interval === "year" ? "; we'll email you a week before" : ""}.
            </>
          )}
        </p>
      )}
      {paused > 0 && plan === "FREE" && (
        <p className="text-sm">
          {paused} of your cases {paused === 1 ? "is" : "are"} paused because the Free plan checks 1 case. Upgrade to check them all again, or
          choose which case to check on its page.
        </p>
      )}

      {!enabled ? (
        plan === "FREE" && (
          <p className="text-sm text-[var(--muted)]">
            Premium (up to 10 cases for your family, checked twice a day) is coming soon for {formatUsd(PRICES.premium.yearly)} a year.
          </p>
        )
      ) : plan === "FREE" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">Premium: up to 10 cases for your family, checked twice a day. Cancel any time in two clicks.</p>
          <div className="flex flex-wrap items-start gap-3">
            <CheckoutButton fields={{ kind: "premium", interval: "year" }}>
              Get Premium: {formatUsd(PRICES.premium.yearly)}/year ({perMonth(PRICES.premium.yearly)}/month)
            </CheckoutButton>
            <CheckoutButton fields={{ kind: "premium", interval: "month" }} secondary>
              Or {formatUsd(PRICES.premium.monthly)}/month
            </CheckoutButton>
          </div>
          <p className="text-xs text-[var(--muted)]">Secure payment by Stripe. Sales tax is added where it applies.</p>
          {hasCustomer && <PortalButton scope="user">Billing history</PortalButton>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <PortalButton scope="user">{sub?.cancelAtPeriodEnd ? "Renew or manage billing" : "Manage billing or cancel"}</PortalButton>
        </div>
      )}
    </div>
  );
}
