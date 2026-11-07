import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/case-tags";
import type { TagView } from "@/lib/cases/tags";
import { ReadyRing, TrophyIcon } from "@/components/my-cases-ui";

export type CaseRow = {
  id: string;
  nickname: string | null;
  receiptMasked: string;
  formType: string | null;
  statusTitleEn: string | null;
  statusTitleEs: string | null;
  lastCheckedAt: Date | null;
  lastChangeObservedAt: Date | null;
  pausedReason?: string | null;
  client?: { id: string; displayName: string } | null;
  hasConsent?: boolean;
  /** Personal cases: the person's tags on it. */
  tags?: TagView[];
  /** A few words on what to do now ("Prepare for your interview"). */
  nextStep?: { en: string; es: string } | null;
  /** Approved cases: the Journey approved page. */
  approvedHref?: string | null;
  /** Cases in progress with a document checklist: how many required documents are ticked. */
  docs?: { href: string; pct: number } | null;
};

/** Share my journey (approved) or the documents ring (in progress), above the row's own link. */
function RowExtras({ c, es }: { c: CaseRow; es: boolean }) {
  if (!c.approvedHref && !c.docs) return null;
  return (
    <span className="relative z-10 flex flex-wrap items-center gap-2">
      {c.approvedHref && (
        <Link href={c.approvedHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9a632] bg-[#f2c14e] px-2.5 py-1 text-xs font-extrabold text-[#0f1b2d] hover:bg-[#e0ae3a]">
          <TrophyIcon size={13} />
          {es ? "Compartir mi trayectoria" : "Share my journey"}
        </Link>
      )}
      {c.docs && (
        <Link href={c.docs.href} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold hover:border-[var(--accent)]">
          <ReadyRing pct={c.docs.pct} size={20} />
          {es ? `Documentos: ${c.docs.pct}% listo` : `Documents ${c.docs.pct}% ready`}
        </Link>
      )}
    </span>
  );
}

function NextStep({ step, es }: { step: { en: string; es: string }; es: boolean }) {
  return (
    <span className="inline-flex items-start gap-1.5 rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs leading-snug">
      <span aria-hidden="true" className="text-[var(--accent)]">
        →
      </span>
      <span>
        <strong className="font-semibold">{es ? "Próximo paso" : "Next step"}:</strong> {es ? step.es : step.en}
      </span>
    </span>
  );
}

/**
 * Case list: a table on wider screens, a compact list on phones. The USCIS
 * wording is always shown; the coloured label only groups it.
 */
export function CaseTable({ rows, hrefBase, es = false, showClient = false, fixed = false }: { rows: CaseRow[]; hrefBase: string; es?: boolean; showClient?: boolean; /** Same column widths in every table (several tables one under another). */ fixed?: boolean }) {
  const dateCell = `${fixed ? "" : "whitespace-nowrap "}px-4 py-3 align-top text-[var(--muted)]`;
  const title = (c: CaseRow) => (es ? c.statusTitleEs : c.statusTitleEn) ?? c.statusTitleEn ?? (es ? "Sin consultar" : "Not checked yet");
  const note = (c: CaseRow) =>
    c.pausedReason === "plan_limit" ? "Paused: Free plan checks 1 case" : c.hasConsent === false ? "Consent withdrawn: not checked" : null;
  return (
    <>
      {/* Wide screens */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className={`w-full border-collapse text-left text-sm ${fixed ? "table-fixed" : ""}`}>
          {fixed && (
            <colgroup>
              <col className="w-[27%]" />
              <col className="w-[37%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
          )}
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Case</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Last change</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Last checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((c) => (
              <tr key={c.id} className="relative hover:bg-[var(--surface-2)]">
                <td className="px-4 py-3 align-top">
                  <Link href={`${hrefBase}/${c.id}`} className="font-semibold after:absolute after:inset-0 focus-visible:outline-none">
                    {showClient && c.client ? `${c.client.displayName} · ` : ""}
                    {c.nickname ?? c.receiptMasked}
                  </Link>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {c.nickname ? `${c.formType ? `${c.formType} · ` : ""}${c.receiptMasked}` : (c.formType ?? "")}
                  </div>
                  {c.tags?.length ? (
                    <div className="mt-1.5">
                      <TagList tags={c.tags} />
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge titleEn={c.statusTitleEn} es={es} />
                    <span>{title(c)}</span>
                    {c.nextStep && <NextStep step={c.nextStep} es={es} />}
                    <RowExtras c={c} es={es} />
                    {note(c) && <span className="text-xs font-medium text-[var(--danger)]">{note(c)}</span>}
                  </div>
                </td>
                <td className={dateCell}>
                  <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="—" />
                </td>
                <td className={dateCell}>
                  <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones */}
      <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] md:hidden">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`${hrefBase}/${c.id}`} className="flex flex-col gap-1.5 p-4 hover:bg-[var(--surface-2)]">
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold">
                  {showClient && c.client ? `${c.client.displayName} · ` : ""}
                  {c.nickname ?? c.receiptMasked}
                </span>
                <StatusBadge titleEn={c.statusTitleEn} es={es} />
              </span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {c.nickname ? `${c.formType ? `${c.formType} · ` : ""}${c.receiptMasked}` : (c.formType ?? "")}
              </span>
              <TagList tags={c.tags} />
              <span className="text-sm">{title(c)}</span>
              {c.nextStep && <NextStep step={c.nextStep} es={es} />}
              <span className="text-xs text-[var(--muted)]">
                Last checked <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
              </span>
              {note(c) && <span className="text-xs font-medium text-[var(--danger)]">{note(c)}</span>}
            </Link>
            {(c.approvedHref || c.docs) && (
              <div className="px-4 pb-4">
                <RowExtras c={c} es={es} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
