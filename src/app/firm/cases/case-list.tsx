import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import type { CaseView } from "@/lib/cases/service";

type Row = CaseView & { client: { id: string; displayName: string } | null; hasConsent?: boolean };

export function FirmCaseList({ cases, empty }: { cases: Row[]; empty: string }) {
  if (cases.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {cases.map((c) => (
        <li key={c.id}>
          <Link
            href={`/firm/cases/${c.id}`}
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {c.client ? `${c.client.displayName} · ` : ""}
                {c.nickname ?? c.receiptMasked}
              </span>
              <span className="font-mono text-sm text-[var(--muted)]">
                {c.formType ? `${c.formType} · ` : ""}
                {c.receiptMasked}
              </span>
            </div>
            <span>{c.statusTitleEn ?? "Not checked yet"}</span>
            <span className="text-xs text-[var(--muted)]">
              Last checked <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
              {c.hasConsent === false && <span className="font-medium text-[var(--danger)]"> · Consent withdrawn, not being checked</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
