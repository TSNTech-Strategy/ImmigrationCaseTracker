import type { Metadata } from "next";
import Link from "next/link";
import { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "@/lib/firms/service";
import { FIRM_PLANS, formatUsd, FOUNDING_FIRM_OFFER, perMonth, PRICES } from "@/lib/plans";
import { billingEnabled } from "@/lib/billing/stripe";

export const metadata: Metadata = {
  title: "Pricing · CasePingo",
  description: `Track one USCIS case free. Premium for the whole family is ${formatUsd(PRICES.premium.yearly)} a year.`,
};

type Card = {
  name: string;
  for: string;
  price: string;
  period: string;
  note?: string;
  features: string[];
  highlight?: boolean;
  cta?: { label: string; href: string };
  /** Call to action once billing is switched on. */
  paid?: { label: string; href: string };
};

const INDIVIDUAL: Card[] = [
  {
    name: "Free",
    for: "One case",
    price: "$0",
    period: "",
    note: "Free forever. No card needed.",
    features: ["1 case", "Check the status yourself, up to 3 times a day", "Full status history, English and Spanish", "New accounts start with 7 days of Premium"],
    cta: { label: "Create a free account", href: "/signup" },
  },
  {
    name: "Premium",
    for: "You and your family",
    price: formatUsd(PRICES.premium.yearly),
    period: "/year",
    note: `That's ${perMonth(PRICES.premium.yearly)} a month. Or ${formatUsd(PRICES.premium.monthly)} month to month.`,
    features: [
      "Checked automatically twice a day: no more checking",
      "Email alert the moment a status changes; phone push alerts with the app",
      "Up to 10 cases for the whole family",
      "Everything in Free",
    ],
    highlight: true,
    paid: { label: "Get Premium", href: "/settings#plan-h" },
  },
];

const FIRMS: Card[] = [
  {
    name: FIRM_PLANS.SOLO.label,
    for: "Solo attorneys and accredited representatives",
    price: formatUsd(FIRM_PLANS.SOLO.price),
    period: "/month",
    features: [`Up to ${FIRM_PLANS.SOLO.maxCases} client cases`, `${FIRM_PLANS.SOLO.maxUsers} team members`, "Clients, consent records (G-28)", "CSV import, activity log and export"],
    cta: { label: "Start your free trial", href: "/firm" },
  },
  {
    name: FIRM_PLANS.FIRM.label,
    for: "Growing immigration practices",
    price: formatUsd(FIRM_PLANS.FIRM.price),
    period: "/month",
    features: [`Up to ${FIRM_PLANS.FIRM.maxCases} client cases`, "Unlimited team members and roles", "Everything in Firm Solo", "Alerts to the person who added each case"],
    cta: { label: "Start your free trial", href: "/firm" },
  },
];

function PlanCard({ p: card }: { p: Card }) {
  const p = billingEnabled() && card.paid ? { ...card, cta: card.paid } : card;
  return (
    <li
      className={`relative flex flex-col gap-5 rounded-xl border bg-[var(--surface)] p-7 ${p.highlight ? "border-2 border-[var(--accent)] shadow-[var(--shadow)]" : "border-[var(--border)]"}`}
    >
      {p.highlight && (
        <span className="absolute -top-3 left-7 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]">Best value</span>
      )}
      <div>
        <h3 className="text-lg font-bold">{p.name}</h3>
        <p className="text-sm text-[var(--muted)]">{p.for}</p>
      </div>
      <p>
        <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
        <span className="text-[var(--muted)]">{p.period}</span>
        {p.note && <span className="mt-1 block text-sm text-[var(--muted)]">{p.note}</span>}
      </p>
      <ul className="flex flex-1 flex-col gap-2.5 text-sm">
        {p.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-none text-[var(--success)]" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      {p.cta ? (
        <Link
          href={p.cta.href}
          className={`rounded-lg px-4 py-3 text-center font-semibold ${p.highlight ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]" : "border border-[var(--border)] hover:bg-[var(--surface-2)]"}`}
        >
          {p.cta.label}
        </Link>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-center text-sm text-[var(--muted)]">
          Coming soon.{" "}
          <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
            Start free today
          </Link>
        </p>
      )}
    </li>
  );
}

export default function Pricing() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-16">
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Pricing</p>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">Simple, affordable pricing</h1>
        <p className="text-lg leading-relaxed text-[var(--muted)]">
          Track one case free, forever. Premium covers your whole family for less than a cup of coffee a month. You pay for the
          convenience, never for access to anyone&apos;s immigration information.
        </p>
      </div>

      <section aria-labelledby="individuals-h" className="flex flex-col gap-6">
        <h2 id="individuals-h" className="text-2xl font-bold">
          For individuals and families
        </h2>
        <ul className="grid gap-6 md:grid-cols-2">
          {INDIVIDUAL.map((p) => (
            <PlanCard key={p.name} p={p} />
          ))}
        </ul>
      </section>

      <section id="firms" aria-labelledby="firms-h" className="flex scroll-mt-24 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="firms-h" className="text-2xl font-bold">
            For immigration law firms (CasePingo Pro)
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Every firm starts with a {TRIAL_DAYS}-day free trial for up to {TRIAL_CASE_LIMIT} cases. No card needed.
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand-red)] bg-[var(--surface)] px-5 py-4 text-sm">
          <span className="rounded-full bg-[var(--brand-red)] px-2.5 py-0.5 text-xs font-bold text-white">Launch offer</span>
          <strong>Founding firm offer:</strong> the first {FOUNDING_FIRM_OFFER.firms} firms get {FOUNDING_FIRM_OFFER.percentOff}% off for
          their first {FOUNDING_FIRM_OFFER.months} months.
        </p>
        <ul className="grid gap-6 md:grid-cols-2">
          {FIRMS.map((p) => (
            <PlanCard key={p.name} p={p} />
          ))}
        </ul>
        <p className="text-sm text-[var(--muted)]">Larger firms: higher volumes and onboarding are available by quote.</p>
      </section>

      <section aria-labelledby="promise-h" className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-7 text-sm">
        <h2 id="promise-h" className="text-xl font-bold">
          Our billing promise
        </h2>
        <ul className="grid gap-2 pl-5 sm:grid-cols-2 [&>li]:list-disc">
          <li>Cancel any time from Settings, in two clicks. No phone calls, no forms.</li>
          <li>We email you before every yearly renewal, so you&apos;re never surprised by a charge.</li>
          <li>No hidden fees. Prices are in US dollars, and include all features listed.</li>
          <li>If you cancel, you keep Premium until the end of the period you paid for, then move to Free. Your cases and history stay.</li>
        </ul>
        <p className="text-[var(--muted)]">
          {billingEnabled() ? "Prices don't include sales tax, which is added at checkout where it applies." : "Paid plans aren't available yet. Everyone can use the Free plan today."}
        </p>
      </section>
    </div>
  );
}
