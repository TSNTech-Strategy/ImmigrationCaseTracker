import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmSyncService } from "@/lib/firms";
import { NEEDS_ATTENTION, OUTCOME_LABELS } from "@/lib/firms/sync";
import { formInfo } from "@/lib/case-insights";
import { LocalTime } from "@/components/local-time";
import { StatTile } from "@/components/dashboard-charts";
import { EmptyState, td, th } from "@/components/workspace-ui";
import { FirmRefreshButton } from "../../cases/forms";

export const metadata: Metadata = { title: "Sync · CasePingo" };

const HEALTH = {
  good: { label: "Working normally", text: "Every case checked recently got an answer from USCIS.", cls: "border-[var(--success)] text-[var(--success)]" },
  delayed: { label: "Some checks are delayed", text: "USCIS didn't answer for a few cases. We try again automatically; nothing to do unless it lasts.", cls: "border-[var(--st-action)] text-[var(--st-action)]" },
  attention: { label: "Some cases need a look", text: "USCIS couldn't find or didn't accept some receipt numbers. Check them below.", cls: "border-[var(--danger)] text-[var(--danger)]" },
  paused: { label: "Checks are paused", text: "Your free trial has ended, so cases aren't being checked. An Owner can choose a plan in Plan & billing.", cls: "border-[var(--danger)] text-[var(--danger)]" },
} as const;

type Row = { id: string; receiptMasked: string; nickname: string | null; formType: string | null; lastCheckedAt: Date | null; lastCheckOutcome: string | null; client: { displayName: string } | null };

function CaseTable({ rows, caption, action }: { rows: Row[]; caption: string; action?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <tr>
            <th className={th}>Case</th>
            <th className={th}>Client</th>
            <th className={th}>Last check</th>
            <th className={th}>Result</th>
            {action && <th className={th}>
              <span className="sr-only">Check again</span>
            </th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((r) => {
            const outcome = r.lastCheckOutcome ?? "";
            return (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/firm/cases/${r.id}`} className="font-medium hover:underline">
                    {r.nickname ?? `${formInfo(r.formType)?.code ?? "Case"} ${r.receiptMasked}`}
                  </Link>
                </td>
                <td className={td}>{r.client?.displayName ?? <span className="text-[var(--muted)]">No client</span>}</td>
                <td className={`${td} whitespace-nowrap text-[var(--muted)]`}>{r.lastCheckedAt ? <LocalTime iso={r.lastCheckedAt.toISOString()} /> : "Not yet"}</td>
                <td className={td}>
                  <span className={outcome === "ok" ? "text-[var(--success)]" : NEEDS_ATTENTION.has(outcome) ? "font-medium text-[var(--danger)]" : "text-[var(--st-action)]"}>{OUTCOME_LABELS[outcome] ?? outcome ?? "—"}</span>
                </td>
                {action && (
                  <td className={`${td} text-right`}>
                    <FirmRefreshButton caseId={r.id} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function SyncPage() {
  const user = await requireUser("/firm/settings/sync");
  const d = await firmSyncService().overview(user.id);
  if (!d) redirect("/firm");
  const h = HEALTH[d.health];
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sync</h1>
        <p className="text-sm text-[var(--muted)]">
          How your cases are checked with USCIS. We use USCIS&apos;s official Case Status API, never scraping, and only for cases with a recorded consent.
        </p>
      </div>

      <section aria-label="Sync health" className={`flex flex-col gap-1 rounded-lg border-l-4 border-y border-r border-y-[var(--border)] border-r-[var(--border)] bg-[var(--surface)] px-4 py-3 ${h.cls}`}>
        <p className="font-semibold">{h.label}</p>
        <p className="text-sm text-[var(--foreground)]">{h.text}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Schedule" value={`Every ${d.schedule.everyHours}h`} note={d.schedule.running ? (d.schedule.next ? "Automatic checks are on" : "Next check soon") : "Paused"} />
        <StatTile label="Being checked" value={d.counts.active} note={d.counts.paused ? `${d.counts.paused} paused (no consent)` : "Every active case"} href="/firm/cases" />
        <StatTile label="Checked in 24 hours" value={d.counts.checkedDay} note={d.counts.neverChecked ? `${d.counts.neverChecked} waiting for a first check` : "Including manual checks"} />
        <StatTile label="Last check failed" value={d.counts.failing} note="Retried automatically" tone="attention" />
      </div>
      {d.schedule.next && d.schedule.running && (
        <p className="text-sm text-[var(--muted)]">
          {d.schedule.dueNow ? "Some cases are due for a check now; they're picked up within a few minutes." : <>Next scheduled check: <LocalTime iso={d.schedule.next.toISOString()} />.</>} Anyone on the team can check a single case now from its page.
        </p>
      )}

      <section aria-labelledby="problems-h" className="flex flex-col gap-3">
        <h2 id="problems-h" className="text-lg font-semibold">
          Cases USCIS didn&apos;t answer for
        </h2>
        {d.problems.length === 0 ? (
          <EmptyState title="Nothing to fix">The last check for every case worked.</EmptyState>
        ) : (
          <CaseTable rows={d.problems} caption="Cases whose last check failed" action />
        )}
      </section>

      <section aria-labelledby="recent-h" className="flex flex-col gap-3">
        <h2 id="recent-h" className="text-lg font-semibold">
          Recent checks
        </h2>
        {d.recent.length === 0 ? <EmptyState title="No checks yet">Cases are checked as soon as they&apos;re added.</EmptyState> : <CaseTable rows={d.recent} caption="The 10 most recent checks" />}
      </section>
    </div>
  );
}
