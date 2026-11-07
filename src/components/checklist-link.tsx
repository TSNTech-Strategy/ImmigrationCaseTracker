import Link from "next/link";
import { checklistPath, type Checklist } from "@/lib/checklists";

/** From a case page to the document checklist for its form. */
export function ChecklistLink({ checklist: c }: { checklist: Checklist }) {
  return (
    <Link
      href={checklistPath(c.key)}
      className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6h11M9 12h11M9 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">Documents for Form {c.form}</span>
          <span className="text-sm text-[var(--muted)]">The {c.title.en.toLowerCase()} checklist: what USCIS usually asks for, ticked off as you gather it.</span>
        </span>
      </span>
      <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
