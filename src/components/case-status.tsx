import Link from "next/link";
import type { ReactNode } from "react";
import type { CaseStatusEvent } from "@prisma/client";
import { LocalTime } from "@/components/local-time";
import { UscisText } from "@/components/uscis-text";
import { StatusBadge, statusDotClass } from "@/components/status-badge";
import { checkFailureMessage, uscisErrorText } from "@/lib/cases/policy";
import type { CaseView } from "@/lib/cases/service";
import { PROCESSING_TIMES_URL, formInfo, receivingOffice } from "@/lib/case-insights";
import { findStatusGuide, guidePath, guideText } from "@/lib/status-guide";
import type { CaseJourney } from "@/lib/journeys";
import { formatDay } from "@/components/line-map";

type HistoryItem = { date?: { raw?: string } | null; textEn?: string | null; textEs?: string | null };

const GUIDE_LABELS = {
  en: { meaning: "What this means", next: "What usually happens next", todo: "What you can do", more: "More about this status", note: "General information, not legal advice." },
  es: { meaning: "Qué significa", next: "Qué suele pasar después", todo: "Qué puede hacer", more: "Más sobre este estado", note: "Información general, no es asesoría legal." },
};

/**
 * Plain-language explanation of the current status. Individuals see it open;
 * on firm pages it starts collapsed, since attorneys know the statuses.
 */
export function StatusGuide({ titleEn, es, collapsed = false }: { titleEn: string | null; es: boolean; collapsed?: boolean }) {
  const g = findStatusGuide(titleEn);
  if (!g) return null;
  const lang = es ? "es" : "en";
  const L = GUIDE_LABELS[lang];
  const t = guideText(g, lang);
  const body = (
    <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{L.meaning}</h3>
        <p className="mt-0.5">{t.meaning}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{L.next}</h3>
        <p className="mt-0.5">{t.next}</p>
      </div>
      {t.todo && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{L.todo}</h3>
          <p className="mt-0.5">{t.todo}</p>
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">
        {L.note}{" "}
        <Link href={guidePath(g)} className="underline underline-offset-2 hover:text-[var(--foreground)]">
          {L.more}
        </Link>
      </p>
    </div>
  );
  if (collapsed) {
    return (
      <details className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{L.meaning}</summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }
  return <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">{body}</div>;
}

/** Form, receiving office, and a pointer to USCIS's official processing times. */
export function FormAndOffice({ formType, receiptMasked }: { formType: string | null; receiptMasked: string }) {
  const form = formInfo(formType);
  const office = receivingOffice(receiptMasked);
  if (!form && !office) return null;
  const pick = [form ? `Form ${form.code}` : null, office?.name ? `“${office.name.en}”` : null].filter(Boolean).join(" and ");
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {form && (
          <div>
            <dt className="text-[var(--muted)]">Form</dt>
            <dd>
              <span className="font-mono">{form.code}</span>
              {form.name && <span className="text-[var(--muted)]"> · {form.name.en}</span>}
            </dd>
          </div>
        )}
        {office && (
          <div>
            <dt className="text-[var(--muted)]">Received at (from the receipt number)</dt>
            <dd>{office.name ? `${office.name.en} (${office.code})` : `USCIS office code ${office.code}`}</dd>
          </div>
        )}
      </dl>
      <p className="text-[var(--muted)]">
        How long it usually takes:{" "}
        <a href={PROCESSING_TIMES_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
          USCIS processing times
        </a>
        {pick ? <>. Choose {pick}.</> : "."} If your case was transferred, use the office on your latest notice.
      </p>
    </div>
  );
}

/** Current status card shared by the individual and firm case pages. */
export function CaseStatusPanel({
  c,
  es,
  actions,
  footnote,
  guideCollapsed = false,
  journey,
}: {
  c: CaseView;
  es: boolean;
  actions?: ReactNode;
  footnote?: ReactNode;
  guideCollapsed?: boolean;
  /** Day counts from the line map (filed, total, since the last update). */
  journey?: CaseJourney;
}) {
  const days = journey?.days;
  const primary = { title: es ? c.statusTitleEs : c.statusTitleEn, desc: es ? c.statusDescriptionEs : c.statusDescriptionEn };
  const secondary = { title: es ? c.statusTitleEn : c.statusTitleEs, desc: es ? c.statusDescriptionEn : c.statusDescriptionEs };
  const failed = c.lastCheckOutcome && c.lastCheckOutcome !== "ok";
  return (
    <section aria-labelledby="status-h" className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="status-h" className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Current status
        </h2>
        <StatusBadge titleEn={c.statusTitleEn} es={es} />
      </div>
      <p className="text-2xl font-semibold leading-snug">{primary.title ?? "Not checked yet"}</p>
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
      <StatusGuide titleEn={c.statusTitleEn} es={es} collapsed={guideCollapsed} />
      {failed && (
        <div role="alert" className="flex flex-col gap-1 rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          <p>Last check didn&apos;t succeed: {checkFailureMessage(c.lastCheckOutcome!, c.lastCheckHttpStatus)}</p>
          {c.lastCheckUscisMessage && <p>{uscisErrorText(c.lastCheckHttpStatus, c.lastCheckUscisMessage)}</p>}
        </div>
      )}
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {days?.filed && (
          <div>
            <dt className="text-[var(--muted)]">Filed</dt>
            <dd>{formatDay(days.filed, false)}</dd>
          </div>
        )}
        {days?.total != null && (
          <div>
            <dt className="text-[var(--muted)]">{journey?.lineMap.finished ? "Total time" : "Time so far"}</dt>
            <dd>
              {days.total.toLocaleString("en-US")} {days.total === 1 ? "day" : "days"}
            </dd>
          </div>
        )}
        {days?.sinceUpdate != null && (
          <div>
            <dt className="text-[var(--muted)]">Last USCIS update</dt>
            <dd>{days.sinceUpdate === 0 ? "Today" : days.sinceUpdate === 1 ? "Yesterday" : `${days.sinceUpdate.toLocaleString("en-US")} days ago`}</dd>
          </div>
        )}
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
        {c.uscisSubmittedRaw && !days?.filed && (
          <div>
            <dt className="text-[var(--muted)]">Submitted (as reported)</dt>
            <dd>{c.uscisSubmittedRaw}</dd>
          </div>
        )}
      </dl>
      <FormAndOffice formType={c.formType} receiptMasked={c.receiptMasked} />
      {actions}
      {footnote && <p className="text-xs text-[var(--muted)]">{footnote}</p>}
    </section>
  );
}

/** A vertical timeline: coloured dot per status kind, newest first. */
function Timeline({ items }: { items: { key: string; titleEn: string | null; label: ReactNode; meta?: ReactNode }[] }) {
  return (
    <ol className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      {items.map((it, i) => (
        <li key={it.key} className="relative flex gap-4 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-[var(--border)]" aria-hidden="true" />}
          <span className={`relative mt-1.5 h-[11px] w-[11px] flex-none rounded-full ring-4 ring-[var(--surface)] ${statusDotClass(it.titleEn)}`} aria-hidden="true" />
          <span className="flex flex-col">
            <span className={i === 0 ? "font-semibold" : "font-medium"}>{it.label}</span>
            {it.meta && <span className="text-xs text-[var(--muted)]">{it.meta}</span>}
          </span>
        </li>
      ))}
    </ol>
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
        <Timeline
          items={events.map((e) => ({
            key: e.id,
            titleEn: e.statusTitleEn,
            label: (es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn ?? "Status recorded",
            meta: (
              <>
                First seen <LocalTime iso={e.firstObservedAt.toISOString()} />
                {e.uscisReportedRaw ? ` · USCIS date ${e.uscisReportedRaw}` : ""}
              </>
            ),
          }))}
        />
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
      <Timeline
        items={history.map((h, i) => ({
          key: String(i),
          titleEn: h.textEn ?? null,
          label: (es ? h.textEs : h.textEn) ?? h.textEn ?? "—",
          meta: h.date?.raw,
        }))}
      />
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
