import Link from "next/link";
import type { FirmTaskPriority, FirmTaskStatus, FirmTaskType } from "@prisma/client";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/firms/tasks";
import { formatDue, dueText } from "@/lib/firms/alerts";
import { PersonCell, td, th } from "@/components/workspace-ui";
import { toggleTaskDoneAction } from "./actions";

export type TaskRow = {
  id: string;
  title: string;
  status: FirmTaskStatus;
  type: FirmTaskType;
  priority: FirmTaskPriority;
  dueOn: Date | null;
  assignee: { id: string; name: string | null; email: string } | null;
  case: { id: string; receiptMasked: string; nickname: string | null } | null;
  client: { id: string; displayName: string } | null;
  _count?: { comments: number };
};

const PRIORITY_STYLE: Record<FirmTaskPriority, string> = {
  URGENT: "bg-[var(--st-stop-bg)] text-[var(--st-stop)]",
  HIGH: "bg-[var(--st-action-bg)] text-[var(--st-action)]",
  MEDIUM: "bg-[var(--st-progress-bg)] text-[var(--st-progress)]",
  LOW: "bg-[var(--surface-2)] text-[var(--muted)]",
  NONE: "",
};

export function PriorityBadge({ p }: { p: FirmTaskPriority }) {
  if (p === "NONE") return null;
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[p]}`}>{TASK_PRIORITIES[p]}</span>;
}

function DoneToggle({ t, back }: { t: TaskRow; back: string }) {
  const done = t.status === "DONE";
  return (
    <form action={toggleTaskDoneAction}>
      <input type="hidden" name="taskId" value={t.id} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <input type="hidden" name="back" value={back} />
      <button
        type="submit"
        aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
        aria-pressed={done}
        className={`flex size-5 items-center justify-center rounded-full border-2 ${done ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
      >
        {done && (
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </button>
    </form>
  );
}

/** Tasks as a table: done toggle, title (type, priority), case or client, assignee, due date, status. */
export function TaskTable({ tasks, today, back, compact = false }: { tasks: TaskRow[]; today: string; back: string; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className={`w-full text-sm ${compact ? "" : "min-w-[820px]"}`}>
        <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <tr>
            <th scope="col" className={`${th} w-10`}>
              <span className="sr-only">Done</span>
            </th>
            <th scope="col" className={th}>Task</th>
            {!compact && <th scope="col" className={th}>Case / client</th>}
            <th scope="col" className={th}>Assignee</th>
            <th scope="col" className={th}>Due</th>
            {!compact && <th scope="col" className={th}>Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {tasks.map((t) => {
            const overdue = t.dueOn && t.status !== "DONE" && t.dueOn < new Date(`${today}T00:00:00Z`);
            return (
              <tr key={t.id} className="hover:bg-[var(--surface-2)]">
                <td className={td}>
                  <DoneToggle t={t} back={back} />
                </td>
                <td className={`${td} max-w-[360px]`}>
                  <Link href={`/firm/tasks/${t.id}`} className={`font-medium hover:underline ${t.status === "DONE" ? "text-[var(--muted)] line-through decoration-1" : ""}`}>
                    {t.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span>{TASK_TYPES[t.type]}</span>
                    <PriorityBadge p={t.priority} />
                    {t._count && t._count.comments > 0 && <span>· {t._count.comments} comment{t._count.comments === 1 ? "" : "s"}</span>}
                  </div>
                </td>
                {!compact && (
                  <td className={`${td} max-w-[220px] truncate`}>
                    {t.case ? (
                      <Link href={`/firm/cases/${t.case.id}`} className="hover:underline">
                        {t.client?.displayName ? `${t.client.displayName} · ` : ""}
                        <span className={t.case.nickname ? "" : "font-mono"}>{t.case.nickname ?? t.case.receiptMasked}</span>
                      </Link>
                    ) : t.client ? (
                      <Link href={`/firm/clients/${t.client.id}`} className="hover:underline">
                        {t.client.displayName}
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                )}
                <td className={`${td} max-w-[160px]`}>
                  <PersonCell person={t.assignee} empty="Nobody" />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {t.dueOn ? (
                    <span className={overdue ? "font-semibold text-[var(--danger)]" : ""}>
                      {formatDue(t.dueOn)}
                      {t.status !== "DONE" && <span className="block text-xs font-normal text-[var(--muted)]">{dueText(t.dueOn, today)}</span>}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">No date</span>
                  )}
                </td>
                {!compact && <td className={`${td} whitespace-nowrap`}>{TASK_STATUSES[t.status]}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
