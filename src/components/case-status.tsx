import type { ReactNode } from "react";
import type { CaseStatusEvent } from "@prisma/client";
import { LocalTime } from "@/components/local-time";
import { UscisText } from "@/components/uscis-text";
import { checkFailureMessage } from "@/lib/cases/policy";
import type { CaseView } from "@/lib/cases/service";

type HistoryItem = { date?: { raw?: string } | null; textEn?: string | null; textEs?: string | null };

/** Current status card shared by the individual and firm case pages. */
export function CaseStatusPanel({ c, es, actions, footnote }: { c: CaseView; es: boolean; actions?: ReactNode; footnote?: ReactNode }) {
  const primary = { title: es ? c.statusTitleEs : c.statusTitleEn, desc: es ? c.statusDescriptionEs : c.statusDescriptionEn };
  const secondary = { title: es ? c.statusTitleEn : c.statusTitleEs, desc: es ? c.statusDescriptionEn : c.statusDescriptionEs };
  const failed = c.lastCheckOutcome && c.lastCheckOutcome !== "ok";
  return (
    <section aria-labelledby="status-h" className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 id="status-h" className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
        Current status
      </h2>
      <p className="text-2xl font-semibold">{primary.title ?? "Not checked yet"}</p>
      {primary.desc && (
        <p className="leading-relaxed">
          <UscisText text={primary.desc} />
        </p>
      )}
      {secondary.title && (
        <details className="text-sm">
          <summary className="cursor-pointer underline underline-offset-2">{es ? "View in English" : "Ver en español"}</summary>
          <p className="mt-2 font-medium">{secondary.title}</p>
          {secondary.desc && (
            <p className="mt-1 leading-relaxed">
              <UscisText text={secondary.desc} />
            </p>
          )}
        </details>
      )}
      {failed && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          Last check didn&apos;t succeed: {checkFailureMessage(c.lastCheckOutcome!)}
        </p>
      )}
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Last checked with USCIS</dt>
          <dd>
            <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Last status change we saw</dt>
          <dd>
            <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="None yet" />
          </dd>
        </div>
        {c.uscisModifiedRaw && (
          <div>
            <dt className="text-[var(--muted)]">USCIS last updated (as reported)</dt>
            <dd>{c.uscisModifiedRaw}</dd>
          </div>
        )}
        {c.uscisSubmittedRaw && (
          <div>
            <dt className="text-[var(--muted)]">Submitted (as reported)</dt>
            <dd>{c.uscisSubmittedRaw}</dd>
          </div>
        )}
      </dl>
      {actions}
      {footnote && <p className="text-xs text-[var(--muted)]">{footnote}</p>}
    </section>
  );
}

export function ObservedChanges({ events, es }: { events: CaseStatusEvent[]; es: boolean }) {
  return (
    <section aria-labelledby="observed-h" className="flex flex-col gap-3">
      <h2 id="observed-h" className="text-lg font-semibold">
        Changes we&apos;ve seen
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing yet.</p>
      ) : (
        <ol className="flex flex-col gap-2 border-l border-[var(--border)] pl-4">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col">
              <span className="font-medium">{(es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn ?? "Status recorded"}</span>
              <span className="text-xs text-[var(--muted)]">
                First seen <LocalTime iso={e.firstObservedAt.toISOString()} />
                {e.uscisReportedRaw ? ` · USCIS date ${e.uscisReportedRaw}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function UscisHistory({ history: raw, es }: { history: CaseView["uscisHistory"]; es: boolean }) {
  const history = (Array.isArray(raw) ? raw : []) as HistoryItem[];
  if (history.length === 0) return null;
  return (
    <section aria-labelledby="history-h" className="flex flex-col gap-3">
      <h2 id="history-h" className="text-lg font-semibold">
        History reported by USCIS
      </h2>
      <ol className="flex flex-col gap-2 border-l border-[var(--border)] pl-4">
        {history.map((h, i) => (
          <li key={i} className="flex flex-col">
            <span className="font-medium">{(es ? h.textEs : h.textEn) ?? h.textEn ?? "—"}</span>
            {h.date?.raw && <span className="text-xs text-[var(--muted)]">{h.date.raw}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export const USCIS_SOURCE_NOTE = (
  <>
    USCIS is the authoritative source:{" "}
    <a href="https://egov.uscis.gov/" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
      USCIS Case Status Online
    </a>
    .
  </>
);
