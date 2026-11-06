import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";

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
};

/**
 * Case list: a table on wider screens, a compact list on phones. The USCIS
 * wording is always shown; the coloured label only groups it.
 */
export function CaseTable({ rows, hrefBase, es = false, showClient = false }: { rows: CaseRow[]; hrefBase: string; es?: boolean; showClient?: boolean }) {
  const title = (c: CaseRow) => (es ? c.statusTitleEs : c.statusTitleEn) ?? c.statusTitleEn ?? (es ? "Sin consultar" : "Not checked yet");
  const note = (c: CaseRow) =>
    c.pausedReason === "plan_limit" ? "Paused: Free plan checks 1 case" : c.hasConsent === false ? "Consent withdrawn: not checked" : null;
  return (
    <>
      {/* Wide screens */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="w-full border-collapse text-left text-sm">
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
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge titleEn={c.statusTitleEn} es={es} />
                    <span>{title(c)}</span>
                    {note(c) && <span className="text-xs font-medium text-[var(--danger)]">{note(c)}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[var(--muted)]">
                  <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="—" />
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[var(--muted)]">
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
              <span className="text-sm">{title(c)}</span>
              <span className="text-xs text-[var(--muted)]">
                Last checked <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
              </span>
              {note(c) && <span className="text-xs font-medium text-[var(--danger)]">{note(c)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
