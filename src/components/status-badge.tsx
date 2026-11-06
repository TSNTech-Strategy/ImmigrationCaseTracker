import { CATEGORY_LABEL, statusCategory, type StatusCategory } from "@/lib/status-category";

const STYLE: Record<StatusCategory, string> = {
  progress: "text-[var(--st-progress)] bg-[var(--st-progress-bg)]",
  action: "text-[var(--st-action)] bg-[var(--st-action-bg)]",
  done: "text-[var(--st-done)] bg-[var(--st-done-bg)]",
  stop: "text-[var(--st-stop)] bg-[var(--st-stop-bg)]",
  none: "text-[var(--st-none)] bg-[var(--st-none-bg)]",
};
const DOT: Record<StatusCategory, string> = {
  progress: "bg-[var(--st-progress)]",
  action: "bg-[var(--st-action)]",
  done: "bg-[var(--st-done)]",
  stop: "bg-[var(--st-stop)]",
  none: "bg-[var(--st-none)]",
};

/** A small coloured label for the kind of status (the USCIS wording is shown next to it). */
export function StatusBadge({ titleEn, es = false }: { titleEn: string | null | undefined; es?: boolean }) {
  const cat = statusCategory(titleEn);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${STYLE[cat]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[cat]}`} aria-hidden="true" />
      {es ? CATEGORY_LABEL[cat].es : CATEGORY_LABEL[cat].en}
    </span>
  );
}

export const statusDotClass = (titleEn: string | null | undefined) => DOT[statusCategory(titleEn)];
