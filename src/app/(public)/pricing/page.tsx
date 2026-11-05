import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pricing · CasePingo" };

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    for: "Individuals",
    features: ["1 case", "Checked automatically once a day", "Email alert when the status changes", "Full status history, English and Spanish"],
    cta: "Create account",
    href: "/signup",
  },
  {
    name: "Premium",
    price: "$5.99",
    period: "/month",
    note: "or $49/year",
    for: "Individuals and families",
    features: ["Up to 10 cases for the whole family", "Checked automatically twice a day", "Faster alerts (push and text coming)", "Everything in Free"],
    soon: true,
  },
  {
    name: "CasePingo Pro",
    price: "$99",
    period: "/month",
    note: "14-day free trial",
    for: "Immigration law firms · Firm Starter",
    features: ["Up to 100 authorized client cases", "Staff accounts and roles", "CSV import", "Audit trail and export"],
    soon: true,
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-14">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-[var(--muted)]">
          You pay for the software&apos;s convenience and team features, never for access to anyone&apos;s immigration information. Paid
          plans aren&apos;t available yet.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <li key={p.name} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-sm text-[var(--muted)]">{p.for}</p>
            </div>
            <p>
              <span className="text-3xl font-semibold">{p.price}</span>
              <span className="text-[var(--muted)]">{p.period}</span>
              {p.note && <span className="block text-sm text-[var(--muted)]">{p.note}</span>}
            </p>
            <ul className="flex flex-1 flex-col gap-1.5 text-sm">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            {p.soon ? (
              <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--muted)]">Coming soon</p>
            ) : (
              <Link href={p.href!} className="rounded-md bg-[var(--accent)] px-4 py-2 text-center font-medium text-[var(--accent-fg)]">
                {p.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-[var(--muted)]">Larger firms: higher volumes and onboarding are available by quote.</p>
    </div>
  );
}
