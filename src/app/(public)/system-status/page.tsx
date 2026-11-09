import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { liveSystemStatus, usingUscisSandbox } from "@/lib/system-status-live";
import { INCIDENTS, type Level } from "@/lib/system-status";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "System status · CasePingo",
  description: "Live status of CasePingo: website, database, USCIS status checks, scheduled reminders, email and document storage.",
};

const LOOK: Record<Level, { label: string; dot: string; banner: string }> = {
  operational: { label: "Operational", dot: "bg-[var(--success)]", banner: "border-[var(--success)] text-[var(--success)]" },
  degraded: { label: "Degraded", dot: "bg-[var(--st-action)]", banner: "border-[var(--st-action)] text-[var(--st-action)]" },
  down: { label: "Outage", dot: "bg-[var(--danger)]", banner: "border-[var(--danger)] text-[var(--danger)]" },
  not_configured: { label: "Not set up", dot: "bg-[var(--muted)]", banner: "border-[var(--border)] text-[var(--muted)]" },
};
const HEADLINE: Record<Level, string> = {
  operational: "All systems operational",
  degraded: "Some systems are slower than usual",
  down: "Some systems are having an outage",
  not_configured: "All systems operational",
};

async function Live() {
  await connection();
  const s = await liveSystemStatus();
  const time = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(s.checkedAt);
  return (
    <>
      <section aria-live="polite" className={`flex items-center gap-3 rounded-lg border-2 bg-[var(--surface)] px-5 py-4 ${LOOK[s.overall].banner}`}>
        <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${LOOK[s.overall].dot}`} />
        <div>
          <p className="text-lg font-semibold">{HEADLINE[s.overall]}</p>
          <p className="text-sm text-[var(--muted)]">Checked {time} Eastern. Refresh to check again.</p>
        </div>
      </section>
      {usingUscisSandbox() && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-5 py-3 text-sm">
          <span className="font-medium">Using the USCIS test system.</span> Until USCIS approves our production access, status checks go to USCIS&apos;s test system, which is usually offline on weekends. When it&apos;s offline, checks pause and resume on their own; this isn&apos;t a {SITE.name} outage.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        {s.components.map((c) => (
          <li key={c.key} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-[var(--muted)]">{c.detail}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-sm font-medium">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${LOOK[c.level].dot}`} />
              {LOOK[c.level].label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SystemStatusPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System status</h1>
        <p className="text-[var(--muted)]">
          Live checks of every part of {SITE.name}. If USCIS itself is slow or down, case checks are retried automatically; your data is not affected.
        </p>
      </div>
      <Suspense fallback={<p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-[var(--muted)]">Checking systems…</p>}>
        <Live />
      </Suspense>
      <section aria-labelledby="incidents-h" className="flex flex-col gap-3">
        <h2 id="incidents-h" className="text-xl font-semibold">
          Incidents
        </h2>
        {INCIDENTS.length === 0 ? (
          <p className="text-[var(--muted)]">No incidents reported.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {INCIDENTS.map((i) => (
              <li key={`${i.date}-${i.title}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm text-[var(--muted)]">
                  {i.date} · {i.resolved ? "Resolved" : "Ongoing"}
                </p>
                <p className="font-medium">{i.title}</p>
                <p className="text-sm">{i.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-[var(--muted)]">
        Something not working? Write to {SITE.contactEmail}. Security concerns: see our <Link href="/security" className="text-[var(--accent)] underline underline-offset-2">Security page</Link>.
      </p>
    </div>
  );
}
