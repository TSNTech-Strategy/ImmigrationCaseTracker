import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmTaskService } from "@/lib/firms";
import { LocalTime } from "@/components/local-time";
import { Avatar, Notice } from "@/components/workspace-ui";
import { TASK_STATUSES } from "@/lib/firms/tasks";
import { CommentForm, TaskForm } from "../task-form";
import { taskFormOptions } from "../options";
import { deleteTaskAction } from "../actions";

export const metadata: Metadata = { title: "Task · CasePingo" };

const NOTICES: Record<string, string> = { created: "Task created." };

export default async function TaskPage({ params, searchParams }: PageProps<"/firm/tasks/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/tasks/${id}`);
  const data = await firmTaskService().get(user.id, id);
  if (!data) notFound();
  const { ctx, task, members } = data;
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const options = await taskFormOptions(ctx.firm.id);
  const canDelete = task.createdById === user.id || ctx.membership.role !== "STAFF";
  const who = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email) : "A former team member");
  const people = members.filter((m) => m.id !== user.id).map((m) => m.name.split(/\s+/)[0]!);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href="/firm/tasks" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Tasks
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--muted)]">
          {TASK_STATUSES[task.status]}
          {task.case && (
            <>
              {" · "}
              <Link href={`/firm/cases/${task.case.id}`} className="hover:underline">
                Case {task.case.nickname ?? task.case.receiptMasked}
              </Link>
            </>
          )}
          {task.client && (
            <>
              {" · "}
              <Link href={`/firm/clients/${task.client.id}`} className="hover:underline">
                {task.client.displayName}
              </Link>
            </>
          )}
        </p>
        <h1 className={`text-2xl font-semibold tracking-tight ${task.status === "DONE" ? "text-[var(--muted)] line-through decoration-2" : ""}`}>{task.title}</h1>
        <p className="text-xs text-[var(--muted)]">
          Created by {who(task.createdBy)} <LocalTime iso={task.createdAt.toISOString()} />
          {task.completedAt && (
            <>
              {" · "}Done by {who(task.completedBy)} <LocalTime iso={task.completedAt.toISOString()} />
            </>
          )}
        </p>
      </div>
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      {notice === "delete-error" && <Notice kind="error">Only the person who created this task, an Owner or an Admin can delete it.</Notice>}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <TaskForm
          mode="edit"
          taskId={task.id}
          initial={{
            title: task.title,
            description: task.description ?? "",
            status: task.status,
            type: task.type,
            priority: task.priority,
            dueOn: task.dueOn ? task.dueOn.toISOString().slice(0, 10) : "",
            assigneeId: task.assigneeId ?? "",
            caseId: task.caseId ?? "",
            clientId: task.clientId ?? "",
          }}
          {...options}
        />
      </section>

      <section aria-labelledby="comments-h" className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="comments-h" className="text-lg font-semibold">
          Comments <span className="text-base font-normal tabular-nums text-[var(--muted)]">{task.comments.length}</span>
        </h2>
        {task.comments.length > 0 && (
          <ol className="flex flex-col gap-4">
            {task.comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={who(c.author)} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{who(c.author)}</span>{" "}
                    <span className="text-xs text-[var(--muted)]">
                      <LocalTime iso={c.createdAt.toISOString()} />
                    </span>
                  </p>
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <CommentForm taskId={task.id} people={people} />
      </section>

      {canDelete && (
        <form action={deleteTaskAction} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4 text-sm">
          <input type="hidden" name="taskId" value={task.id} />
          <span className="text-[var(--muted)]">Deleting removes the task and its comments for everyone.</span>
          <button type="submit" className="rounded-md border border-[var(--danger)] px-3 py-1.5 font-medium text-[var(--danger)] hover:bg-[var(--st-stop-bg)]">
            Delete task
          </button>
        </form>
      )}
    </div>
  );
}
