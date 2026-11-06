import Link from "next/link";
import { Suspense } from "react";
import { QueryNotice } from "@/components/query-notice";
import { FIRM_PLANS, formatUsd, perMonth, PLAN_LIMITS, PREMIUM_TRIAL_DAYS, PRICES } from "@/lib/plans";
import { SITE } from "@/lib/site";

const NOTICES: Record<string, string> = {
  "account-deleted": "Your account and all of your case data have been deleted.",
};

/** The parts of a USCIS receipt number (format documented by USCIS and immigration practitioners). */
const RECEIPT_PARTS = [
  { chars: "EAC", label: "Where it was received", detail: "EAC Vermont · WAC California · LIN Nebraska · SRC Texas · MSC/NBC National Benefits Center · IOE filed online" },
  { chars: "26", label: "Fiscal year", detail: "USCIS's fiscal year starts on October 1" },
  { chars: "042", label: "Workday", detail: "The working day of that fiscal year when the case was entered" },
  { chars: "51234", label: "Case number", detail: "Its place in that day's line" },
];

/** A typical family-based path, in USCIS's own words. Not every case follows it. */
const JOURNEY = [
  "Case Was Received",
  "Fingerprint Fee Was Received",
  "Case Is Being Actively Reviewed By USCIS",
  "Interview Was Scheduled",
  "Case Was Approved",
  "New Card Is Being Produced",
  "Card Was Mailed To Me",
];

const FAQ: [string, string][] = [
  ["Is CasePingo part of USCIS?", "No. We're an independent company. We read your status from USCIS's official Case Status API, and USCIS remains the authoritative source. We can't change, speed up or influence a case."],
  ["Where does the status come from?", "From the same USCIS data you see at egov.uscis.gov, in USCIS's exact wording, in English and Spanish. We show when we last checked and when we last saw it change, separately."],
  ["What do you do with my receipt number?", "We encrypt it before storing it, show only the last three digits after you add it, and never put it in emails or notifications. You can delete a case, or your whole account, at any time."],
  ["Can I track my parents' or my spouse's case?", "Yes, if they've given you permission. You confirm that each time you add a case, and Premium covers up to 10 cases."],
  ["What does the Free plan include?", `One case. You can check it yourself up to ${PLAN_LIMITS.FREE.manualChecksPerDay} times a day and see the full history. Automatic checks and alerts are part of Premium, and new accounts get ${PREMIUM_TRIAL_DAYS} days of Premium to try them.`],
  ["Do you give legal advice?", "No. For questions about your case, speak with an immigration attorney or a DOJ-accredited representative."],
];

export default function Home() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <Suspense fallback={null}>
          <QueryNotice messages={NOTICES} />
        </Suspense>
      </div>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold text-[var(--brand-red-text)]">USCIS case alerts for families and immigration law firms</p>
          <h1 className="text-4xl leading-[1.08] sm:text-5xl lg:text-[3.6rem]">We check your USCIS case, so you don&apos;t have to.</h1>
          <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Enter the receipt number from your I-797C notice. With Premium, CasePingo checks it with USCIS twice a day, keeps every change
            it sees, and emails you when the status moves. In English or Spanish.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/signup" className="rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
              Create a free account
            </Link>
            <Link href="/how-it-works" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
              How it works
            </Link>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {PREMIUM_TRIAL_DAYS} days of Premium included. No card needed. Not affiliated with USCIS.
          </p>
        </div>

        {/* Receipt number, explained: real-world detail rather than a decorative mockup */}
        <figure className="flex flex-col gap-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7" aria-labelledby="receipt-cap">
          <figcaption id="receipt-cap" className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">Your receipt number, explained</span>
            <span className="text-xs text-[var(--muted)]">Example</span>
          </figcaption>
          <div className="flex flex-wrap gap-x-1 font-mono text-3xl tracking-tight sm:text-4xl" aria-label="Example receipt number EAC2604251234">
            {RECEIPT_PARTS.map((p, i) => (
              <span key={p.chars} className={i === 0 ? "text-[var(--brand-red-text)]" : i === 3 ? "text-[var(--brand-ink)]" : "text-[var(--accent)]"}>
                {p.chars}
              </span>
            ))}
          </div>
          <dl className="grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
            {RECEIPT_PARTS.map((p) => (
              <div key={p.chars} className="flex flex-col gap-0.5">
                <dt className="flex items-baseline gap-2 text-sm font-semibold">
                  <span className="font-mono text-[var(--muted)]">{p.chars}</span>
                  {p.label}
                </dt>
                <dd className="text-sm leading-snug text-[var(--muted)]">{p.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-[var(--muted)]">You&apos;ll find it at the top left of the receipt notice (Form I-797C).</p>
        </figure>
      </section>

      {/* A real status path */}
      <section aria-labelledby="journey-h" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="journey-h" className="text-3xl sm:text-4xl">
              A case moves in small steps. We tell you about each one.
            </h2>
            <p className="text-[var(--muted)]">
              Here&apos;s a typical path for a green card application, in USCIS&apos;s own words. Months can pass between steps; you won&apos;t have
              to keep checking.
            </p>
          </div>
          <ol className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-7">
            {JOURNEY.map((s, i) => (
              <li key={s} className="flex gap-3 lg:flex-col lg:gap-3">
                <span className="flex flex-none items-center gap-2 lg:w-full">
                  <span className={`h-3 w-3 flex-none rounded-full ${i === 4 ? "bg-[var(--st-done)]" : i === 3 ? "bg-[var(--st-action)]" : "bg-[var(--accent)]"}`} />
                  <span className="hidden h-px flex-1 bg-[var(--border)] lg:block" />
                </span>
                <span className="text-sm font-medium leading-snug">{s}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[var(--muted)]">
            Each change arrives as an email: &ldquo;Mom&apos;s I-130: Case Was Approved&rdquo;. Your receipt number is never in the message.
          </p>
        </div>
      </section>

      {/* Honest comparison */}
      <section aria-labelledby="compare-h" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16">
        <h2 id="compare-h" className="max-w-2xl text-3xl sm:text-4xl">
          Checking the USCIS website yourself works. It&apos;s just easy to miss things.
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-2)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-[var(--muted)]"></th>
                <th scope="col" className="px-4 py-3 font-semibold">Checking it yourself</th>
                <th scope="col" className="px-4 py-3 font-semibold">With CasePingo Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {[
                ["Who checks", "You, whenever you remember", "We do, twice a day"],
                ["When you hear about a change", "Next time you look", "By email shortly after we see it"],
                ["History", "Only the latest status", "Every change we've seen, with dates"],
                ["Family members", "One receipt number at a time", "Up to 10 cases on one screen"],
                ["Cost", "Free", `${formatUsd(PRICES.premium.yearly)} a year (${perMonth(PRICES.premium.yearly)} a month)`],
              ].map(([k, a, b]) => (
                <tr key={k}>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {k}
                  </th>
                  <td className="px-4 py-3 text-[var(--muted)]">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* What we do / don't */}
      <section aria-labelledby="scope-h" className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 id="scope-h" className="text-2xl sm:text-3xl">
              What CasePingo does
            </h2>
            <ul className="flex flex-col gap-3 text-[var(--foreground)]">
              {[
                "Reads your status from the official USCIS Case Status API",
                "Keeps a dated history of every change we see",
                "Emails you when it changes (phone notifications with our app, coming soon)",
                "Shows status texts in English and Spanish",
                "Encrypts receipt numbers and lets you delete everything",
              ].map((t) => (
                <li key={t} className="flex gap-3 border-b border-[var(--border)] pb-3 last:border-0">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--st-done)]" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl sm:text-3xl">What it doesn&apos;t do</h2>
            <ul className="flex flex-col gap-3 text-[var(--foreground)]">
              {[
                "Speak for USCIS, or speed up or influence your case",
                "Give legal advice or predict outcomes",
                "Track receipt numbers you aren't authorized to follow",
                "Sell, rent or share your information",
                "Show ads",
              ].map((t) => (
                <li key={t} className="flex gap-3 border-b border-[var(--border)] pb-3 last:border-0">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--muted)]" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Plans, briefly */}
      <section aria-labelledby="plans-h" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="plans-h" className="text-3xl sm:text-4xl">
            Plans
          </h2>
          <Link href="/pricing" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
            Compare plans
          </Link>
        </div>
        <dl className="grid divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="flex flex-col gap-1 p-6">
            <dt className="font-semibold">Free</dt>
            <dd className="text-2xl font-bold">$0</dd>
            <dd className="text-sm text-[var(--muted)]">One case. You check it yourself, up to {PLAN_LIMITS.FREE.manualChecksPerDay} times a day.</dd>
          </div>
          <div className="flex flex-col gap-1 p-6">
            <dt className="font-semibold">Premium</dt>
            <dd className="text-2xl font-bold">
              {formatUsd(PRICES.premium.yearly)} <span className="text-base font-medium text-[var(--muted)]">a year</span>
            </dd>
            <dd className="text-sm text-[var(--muted)]">Up to 10 family cases, checked twice a day, with alerts.</dd>
          </div>
          <div className="flex flex-col gap-1 p-6" id="firms-teaser">
            <dt className="font-semibold">For law firms</dt>
            <dd className="text-2xl font-bold">
              from {formatUsd(FIRM_PLANS.SOLO.price)} <span className="text-base font-medium text-[var(--muted)]">a month</span>
            </dd>
            <dd className="text-sm text-[var(--muted)]">Client cases, team roles, G-28 consent records, CSV import, activity log.</dd>
          </div>
        </dl>
      </section>

      {/* FAQ: plain list, no accordions-in-cards */}
      <section aria-labelledby="faq-h" className="border-t border-[var(--border)]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[1fr_2fr]">
          <h2 id="faq-h" className="text-3xl sm:text-4xl">
            Questions people ask us
          </h2>
          <dl className="flex flex-col divide-y divide-[var(--border)]">
            {FAQ.map(([q, a]) => (
              <div key={q} className="flex flex-col gap-2 py-5 first:pt-0">
                <dt className="font-semibold">{q}</dt>
                <dd className="leading-relaxed text-[var(--muted)]">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-12 sm:flex-row sm:items-center">
          <p className="text-lg">
            <span className="font-semibold">Have your receipt notice handy?</span>{" "}
            <span className="text-[var(--muted)]">It takes about a minute to start.</span>
          </p>
          <Link href="/signup" className="rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
            Create a free account
          </Link>
        </div>
      </section>
      <p className="sr-only">{SITE.disclaimer}</p>
    </>
  );
}
