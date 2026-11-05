import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { QueryNotice } from "@/components/query-notice";
import { FIRM_PLANS, formatUsd, perMonth, PRICES } from "@/lib/plans";
import { SITE } from "@/lib/site";

const NOTICES: Record<string, string> = {
  "account-deleted": "Your account and all of your case data have been deleted.",
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z",
  check: "M5 12l5 5L20 7",
  card: "M3 7h18v10H3zM3 11h18",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
};

function Section({ id, eyebrow, title, intro, children, band }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; band?: boolean }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={band ? "border-y border-[var(--border)] bg-[var(--surface-2)]" : ""}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">{eyebrow}</p>}
          <h2 id={id ? `${id}-h` : undefined} className="text-3xl font-bold sm:text-4xl">
            {title}
          </h2>
          {intro && <p className="text-lg leading-relaxed text-[var(--muted)]">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Illustrative product preview (example data, clearly labelled). */
function ProductPreview() {
  const steps = [
    { t: "Case Was Approved", d: "Today, 9:14 AM", now: true },
    { t: "Interview Was Completed", d: "Oct 2", now: false },
    { t: "Case Was Received", d: "Mar 18", now: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-label="Example of a case in CasePingo" role="img">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_60%_40%,var(--accent-soft),transparent)]" />
      {/* notification */}
      <div className="absolute -top-5 right-0 z-10 flex w-72 items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)] sm:-right-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG mark */}
        <img src="/brand/casepingo-mark.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
        <div className="min-w-0 text-sm">
          <p className="flex justify-between gap-2 font-semibold">
            <span>CasePingo</span>
            <span className="text-xs font-normal text-[var(--muted)]">now</span>
          </p>
          <p className="truncate text-[var(--muted)]">Mom&apos;s I-130: Case Was Approved</p>
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Mom&apos;s I-130</p>
            <p className="font-mono text-xs text-[var(--muted)]">I-130 · EAC*******402</p>
          </div>
          <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">Approved</span>
        </div>
        <ol className="flex flex-col gap-4 border-l-2 border-[var(--border)] pl-5">
          {steps.map((s) => (
            <li key={s.t} className="relative">
              <span
                className={`absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 ${s.now ? "border-[var(--success)] bg-[var(--success)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
              />
              <p className={`text-sm ${s.now ? "font-semibold" : ""}`}>{s.t}</p>
              <p className="text-xs text-[var(--muted)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          <span>Last checked with USCIS: 2 min ago</span>
          <span>English · Español</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--muted)]">Example for illustration</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <Suspense fallback={null}>
          <QueryNotice messages={NOTICES} />
        </Suspense>
      </div>

      {/* Hero: what it is, why trust it, what to do next */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--brand-red-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-red)]" />
            {SITE.tagline}
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
            Your USCIS case, <span className="text-[var(--accent)]">checked for you.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Add your receipt number once. CasePingo checks it with USCIS, keeps the full history, and alerts you the moment it changes, in
            English or Spanish.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)] shadow-sm hover:bg-[var(--accent-hover)]"
            >
              Track my case free
            </Link>
            <Link href="/how-it-works" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-semibold hover:bg-[var(--surface-2)]">
              See how it works
            </Link>
          </div>
          <ul className="grid gap-x-6 gap-y-2 text-sm text-[var(--muted)] sm:grid-cols-2">
            {[
              [ICONS.lock, "Receipt numbers encrypted"],
              [ICONS.shield, "No ads, never sold"],
              [ICONS.globe, "English and Español"],
              [ICONS.card, "No card needed to start"],
            ].map(([d, t]) => (
              <li key={t} className="flex items-center gap-2">
                <span className="text-[var(--success)]">
                  <Icon d={d} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview />
      </section>

      <Section id="how" band eyebrow="How it works" title="Three steps. Then we do the checking." intro="No more refreshing the USCIS website every morning.">
        <ol className="grid gap-5 md:grid-cols-3">
          {[
            ["1", "Add your receipt number", "The 13-character number from your USCIS notice (Form I-797C), like EAC9999103402. We confirm you're allowed to track it."],
            ["2", "We check with USCIS", "Automatically, on a schedule, through the official USCIS API. You see when we last checked and when it last changed."],
            ["3", "Get an alert when it moves", "An email (and soon a phone notification) the moment the status changes, with the full history on your dashboard."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">{n}</span>
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Why CasePingo" title="Built for families going through the process" intro="Simple, private, and honest about what we do and don't do.">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [ICONS.bell, "Alerts that matter", "We only tell you when something actually changes. No spam, no daily noise."],
            [ICONS.users, "The whole family", "Track up to 10 cases on Premium: parents, spouse, children, each with its own name."],
            [ICONS.clock, "Full history", "Every change we've seen, with dates, plus the history USCIS reports."],
            [ICONS.lock, "Private by design", "Receipt numbers are encrypted at rest. We never sell or share your data, and you can delete everything any time."],
            [ICONS.globe, "English and Spanish", "Status texts in both languages, the way USCIS publishes them."],
            [ICONS.card, "Honest billing", "Cancel in two clicks. We email you before a yearly renewal. No surprise charges."],
          ].map(([d, t, p]) => (
            <div key={t} className="flex gap-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon d={d} />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{t}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{p}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section band eyebrow="Pricing" title="Start free. Upgrade when your family needs more.">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-semibold">Free</h3>
            <p className="text-3xl font-bold">$0</p>
            <p className="text-sm text-[var(--muted)]">One case, to try CasePingo.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <h3 className="font-semibold">Premium</h3>
            <p className="text-3xl font-bold">
              {formatUsd(PRICES.premium.yearly)}
              <span className="text-base font-medium text-[var(--muted)]">/year</span>
            </p>
            <p className="text-sm text-[var(--muted)]">
              Up to 10 family cases. That&apos;s {perMonth(PRICES.premium.yearly)} a month.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-semibold">Law firms</h3>
            <p className="text-3xl font-bold">
              from {formatUsd(FIRM_PLANS.SOLO.price)}
              <span className="text-base font-medium text-[var(--muted)]">/month</span>
            </p>
            <p className="text-sm text-[var(--muted)]">Clients, team roles, consent records, CSV import.</p>
          </div>
        </div>
        <Link href="/pricing" className="w-fit font-semibold text-[var(--accent)] hover:underline">
          Compare plans →
        </Link>
      </Section>

      <Section id="faq" eyebrow="Questions" title="Good to know">
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            ["Is CasePingo part of USCIS?", "No. CasePingo is an independent service. It isn't affiliated with or endorsed by USCIS or DHS. We check statuses through the official USCIS API, and USCIS stays the authoritative source."],
            ["Is my receipt number safe?", "Yes. It's encrypted before it's stored, never shown in full after you add it, and never put in emails or alerts. You can delete a case, or your whole account, at any time."],
            ["Can I track my family's cases?", "Yes, as long as each person has given you permission. Premium tracks up to 10 cases, each with its own name like \"Mom's I-130\"."],
            ["Do you give legal advice?", "No. We show what USCIS reports and when it changes. For advice about your case, talk to an immigration attorney or accredited representative."],
            ["What happens if I cancel Premium?", "You keep Premium until the end of the period you paid for, then move to Free. Your cases and history stay."],
            ["Is there an app?", "The website works on any phone. iPhone and Android apps with push notifications are coming soon."],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 open:shadow-[var(--shadow)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-xl leading-none text-[var(--muted)] transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Closing call to action: always navy, in both themes */}
      <section className="px-4 pb-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 rounded-3xl bg-[#0a2345] px-8 py-14 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-col gap-3">
            <h2 className="text-3xl font-bold text-white">Stop checking. Start knowing.</h2>
            <p className="text-white/75">Create a free account in under a minute. We&apos;ll ping you when your case moves.</p>
          </div>
          <Link href="/signup" className="rounded-xl bg-white px-6 py-3 font-semibold text-[#0a2345] hover:bg-white/90">
            Track my case free
          </Link>
        </div>
      </section>
    </>
  );
}
