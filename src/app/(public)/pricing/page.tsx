import type { Metadata } from "next";
import Link from "next/link";
import { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "@/lib/firms/service";
import { FIRM_PLANS, formatUsd, FOUNDING_FIRM_OFFER, perMonth, PRICES } from "@/lib/plans";

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
};

const INDIVIDUAL: Card[] = [
  {
    name: "Free",
    for: "One case",
    price: "$0",
    period: "",
    note: "Free forever. No card needed.",
    features: ["1 case", "Checked automatically once a day", "Email alert when the status changes", "Full status history, English and Spanish"],
    cta: { label: "Create a free account", href: "/signup" },
  },
  {
    name: "Premium",
    for: "You and your family",
    price: formatUsd(PRICES.premium.yearly),
    period: "/year",
    note: `That's ${perMonth(PRICES.premium.yearly)} a month. Or ${formatUsd(PRICES.premium.monthly)} month to month.`,
    features: ["Up to 10 cases for the whole family", "Checked automatically twice a day", "Email alerts (push and text coming)", "Everything in Free"],
    highlight: true,
  },
];

const FIRMS: Card[] = [
  {
    name: FIRM_PLANS.SOLO.label,
    for: "Solo attorneys and accredited representatives",
    price: formatUsd(FIRM_PLANS.SOLO.price),
    period: "/month",
    features: [`Up to ${FIRM_PLANS.SOLO.maxCases} client cases`, `${FIRM_PLANS.SOLO.maxUsers} team members`, "Clients, consent records (G-28)", "CSV import, activity log and export"],
  },
  {
    name: FIRM_PLANS.FIRM.label,
    for: "Growing immigration practices",
    price: formatUsd(FIRM_PLANS.FIRM.price),
    period: "/month",
    features: [`Up to ${FIRM_PLANS.FIRM.maxCases} client cases`, "Unlimited team members and roles", "Everything in Firm Solo", "Alerts to the person who added each case"],
  },
];

function PlanCard({ p }: { p: Card }) {
  return (
    <li
      className={`flex flex-col gap-4 rounded-xl border bg-[var(--surface)] p-6 ${p.highlight ? "border-2 border-[var(--accent)]" : "border-[var(--border)]"}`}
    >
      <div>
        <h3 className="text-lg font-semibold">{p.name}</h3>
        <p className="text-sm text-[var(--muted)]">{p.for}</p>
      </div>
      <p>
        <span className="text-3xl font-semibold">{p.price}</span>
        <span className="text-[var(--muted)]">{p.period}</span>
        {p.note && <span className="mt-1 block text-sm text-[var(--muted)]">{p.note}</span>}
      </p>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {p.features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      {p.cta ? (
        <Link href={p.cta.href} className="rounded-md bg-[var(--accent)] px-4 py-2 text-center font-medium text-[var(--accent-fg)]">
          {p.cta.label}
        </Link>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--muted)]">Coming soon</p>
      )}
    </li>
  );
}

export default function Pricing() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-14">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Simple, affordable pricing</h1>
        <p className="text-[var(--muted)]">
          Track one case free, forever. Premium covers your whole family for less than a cup of coffee a month. You pay for the
          convenience, never for access to anyone&apos;s immigration information.
        </p>
      </div>

      <section aria-labelledby="individuals-h" className="flex flex-col gap-4">
        <h2 id="individuals-h" className="text-xl font-semibold">
          For individuals and families
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {INDIVIDUAL.map((p) => (
            <PlanCard key={p.name} p={p} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="firms-h" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="firms-h" className="text-xl font-semibold">
            For immigration law firms (CasePingo Pro)
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Every firm starts with a {TRIAL_DAYS}-day free trial for up to {TRIAL_CASE_LIMIT} cases. No card needed.
          </p>
        </div>
        <p className="rounded-xl border border-[var(--brand-red)] bg-[var(--surface)] px-4 py-3 text-sm">
          <strong>Founding firm offer:</strong> the first {FOUNDING_FIRM_OFFER.firms} firms get {FOUNDING_FIRM_OFFER.percentOff}% off for
          their first {FOUNDING_FIRM_OFFER.months} months.
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {FIRMS.map((p) => (
            <PlanCard key={p.name} p={p} />
          ))}
        </ul>
        <p className="text-sm text-[var(--muted)]">Larger firms: higher volumes and onboarding are available by quote.</p>
      </section>

      <section aria-labelledby="promise-h" className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm">
        <h2 id="promise-h" className="text-lg font-semibold">
          Our billing promise
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cancel any time from Settings, in two clicks. No phone calls, no forms.</li>
          <li>We email you before every yearly renewal, so you&apos;re never surprised by a charge.</li>
          <li>No hidden fees. Prices are in US dollars, and include all features listed.</li>
          <li>If you cancel, you keep Premium until the end of the period you paid for, then move to Free. Your cases and history stay.</li>
        </ul>
        <p className="text-[var(--muted)]">Paid plans aren&apos;t available yet. Everyone can use the Free plan today.</p>
      </section>
    </div>
  );
}
