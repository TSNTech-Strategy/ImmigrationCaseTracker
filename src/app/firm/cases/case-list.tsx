import { CaseTable, type CaseRow } from "@/components/case-table";

export function FirmCaseList({ cases, empty }: { cases: CaseRow[]; empty: string }) {
  if (cases.length === 0) {
    return <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{empty}</p>;
  }
  return <CaseTable rows={cases} hrefBase="/firm/cases" showClient={cases.some((c) => c.client)} />;
}
