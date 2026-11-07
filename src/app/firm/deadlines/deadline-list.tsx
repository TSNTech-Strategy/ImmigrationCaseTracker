import Link from "next/link";
import type { DeadlineKind } from "@prisma/client";
import { DEADLINE_KINDS, daysUntil, dueText, formatDue } from "@/lib/firms/alerts";
import { removeDeadlineAction, setDeadlineDoneAction } from "./actions";

type Person = { name: string | null; email: string } | null;
export type DeadlineItem = {
  id: string;
  kind: DeadlineKind;
  dueOn: Date;
  note: string | null;
  doneAt: Date | null;
  doneBy: Person;
  case?: { id: string; receiptMasked: string; nickname: string | null; client: { id: string; displayName: string } | null };
};

const who = (u: Person) => (u ? (u.name ?? u.email) : "a former team member");
const btn = "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]";

/** Deadlines as rows: what, when (overdue in red), note, and Done / Undo / Remove. */
export function DeadlineList({ items, today, caseId, from }: { items: DeadlineItem[]; today: string; caseId?: string; from: "case" | "list" }) {
  return (
    <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {items.map((d) => {
        const n = daysUntil(d.dueOn, today);
        const tone = d.doneAt ? "text-[var(--muted)]" : n < 0 ? "text-[var(--danger)]" : n <= 7 ? "text-[var(--st-action)]" : "text-[var(--muted)]";
        return (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className={`font-semibold ${d.doneAt ? "line-through decoration-1" : ""}`}>
                {DEADLINE_KINDS[d.kind].label}: {formatDue(d.dueOn)}
              </p>
              <p className={`text-sm ${tone}`}>
                {d.doneAt ? `Done by ${who(d.doneBy)}` : dueText(d.dueOn, today)}
                {d.note ? <span className="text-[var(--muted)]"> · {d.note}</span> : null}
              </p>
              {d.case && (
                <p className="text-sm">
                  {d.case.client ? (
                    <Link href={`/firm/clients/${d.case.client.id}`} className="hover:underline">
                      {d.case.client.displayName}
                    </Link>
                  ) : (
                    "No client"
                  )}
                  <span className="text-[var(--muted)]"> · </span>
                  <Link href={`/firm/cases/${d.case.id}#deadlines-h`} className={`text-[var(--muted)] hover:underline ${d.case.nickname ? "" : "font-mono"}`}>
                    {d.case.nickname ?? d.case.receiptMasked}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <form action={setDeadlineDoneAction}>
                <input type="hidden" name="deadlineId" value={d.id} />
                <input type="hidden" name="caseId" value={caseId ?? d.case?.id ?? ""} />
                <input type="hidden" name="from" value={from} />
                <input type="hidden" name="done" value={d.doneAt ? "0" : "1"} />
                <button type="submit" className={d.doneAt ? btn : "rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"}>
                  {d.doneAt ? "Undo" : "Mark done"}
                </button>
              </form>
              <form action={removeDeadlineAction}>
                <input type="hidden" name="deadlineId" value={d.id} />
                <input type="hidden" name="caseId" value={caseId ?? d.case?.id ?? ""} />
                <input type="hidden" name="from" value={from} />
                <button type="submit" className={btn} aria-label={`Remove ${DEADLINE_KINDS[d.kind].label} ${formatDue(d.dueOn)}`}>
                  Remove
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const DEADLINE_NOTICES: Record<string, string> = {
  "deadline-done": "Deadline marked done. Its reminders are closed.",
  "deadline-reopened": "Deadline open again.",
  "deadline-removed": "Deadline removed.",
};
