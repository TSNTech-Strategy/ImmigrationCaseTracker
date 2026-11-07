import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmMatterService, firmTaskService } from "@/lib/firms";
import { MATTER_KINDS } from "@/lib/firms/matters";
import { formInfo } from "@/lib/case-insights";
import { StatusBadge } from "@/components/status-badge";
import { LocalTime } from "@/components/local-time";
import { EmptyState, Notice, PersonCell, btn, td, th } from "@/components/workspace-ui";
import { TaskTable } from "../../tasks/task-list";
import { MatterForm } from "../matter-form";
import { archiveMatterAction, setCasesMatterAction } from "../actions";

export const metadata: Metadata = { title: "Matter · CasePingo" };

const KINDS = Object.entries(MATTER_KINDS).map(([value, k]) => ({ value, ...k }));
const NOTICES: Record<string, string> = {
  created: "Matter created. Add its cases below.",
  "matter-same": "No change: already in that matter.",
  "matter-moved": "Cases updated.",
  archived: "Matter archived. Its cases keep being tracked.",
  restored: "Matter restored.",
};

export default async function MatterPage({ params, searchParams }: PageProps<"/firm/matters/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/matters/${id}`);
  const data = await firmMatterService().get(user.id, id);
  if (!data) notFound();
  const { ctx, matter, available } = data;
  const [cases, tasks] = await Promise.all([firmCaseService().listCases(user.id, { matter: matter.id, sort: "client" }), firmTaskService().list(user.id, { scope: "team", status: "active", matterId: matter.id })]);
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const isManager = ctx.membership.role !== "STAFF";
  const back = `/firm/matters/${matter.id}`;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <Link href="/firm/matters" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Matters
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--muted)]">
          {MATTER_KINDS[matter.kind].label} matter
          {matter.archivedAt && " · archived"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{matter.name}</h1>
        {matter.description && <p className="text-sm text-[var(--muted)]">{matter.description}</p>}
      </div>
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      {notice === "matter-error" && <Notice kind="error">That didn&apos;t work. Choose at least one case, and make sure the matter isn&apos;t archived.</Notice>}

      <section aria-labelledby="matter-cases-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="matter-cases-h" className="text-lg font-semibold">
            Cases <span className="text-base font-normal tabular-nums text-[var(--muted)]">{cases?.cases.length ?? 0}</span>
          </h2>
          <Link href={`/firm/cases?matter=${matter.id}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
            Open in the case list
          </Link>
        </div>
        {!cases || cases.cases.length === 0 ? (
          <EmptyState title="No cases in this matter yet">Add them below, or from each case&apos;s page.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <tr>
                  <th scope="col" className={th}>Receipt</th>
                  <th scope="col" className={th}>Client</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Assignee</th>
                  <th scope="col" className={th}>Last change</th>
                  <th scope="col" className={th}>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cases.cases.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                    <td className={td}>
                      <Link href={`/firm/cases/${c.id}`} className="font-mono font-medium hover:underline">
                        {c.receiptMasked}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">{[formInfo(c.formType)?.code, c.nickname].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className={td}>{c.client?.displayName ?? "—"}</td>
                    <td className={`${td} max-w-[220px]`}>
                      <StatusBadge titleEn={c.statusTitleEn} />
                      <div className="truncate text-xs text-[var(--muted)]">{c.statusTitleEn ?? "Not checked yet"}</div>
                    </td>
                    <td className={`${td} max-w-[160px]`}>
                      <PersonCell person={c.assignee} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-[var(--muted)]`}>
                      <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="—" />
                    </td>
                    <td className={`${td} text-right`}>
                      <form action={setCasesMatterAction}>
                        <input type="hidden" name="caseIds" value={c.id} />
                        <input type="hidden" name="matterId" value="" />
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--danger)]" aria-label={`Take ${c.receiptMasked} out of this matter`}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!matter.archivedAt && available.length > 0 && (
          <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Add cases ({available.length} not in a matter)</summary>
            <form action={setCasesMatterAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="matterId" value={matter.id} />
              <input type="hidden" name="back" value={back} />
              <fieldset className="max-h-72 overflow-y-auto rounded-md border border-[var(--border)]">
                <legend className="sr-only">Cases to add</legend>
                {available.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--surface-2)]">
                    <input type="checkbox" name="caseIds" value={c.id} className="size-4 accent-[var(--accent)]" />
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{c.client?.displayName ?? "No client"}</span>
                      <span className="text-[var(--muted)]"> · {[formInfo(c.formType)?.code, c.nickname].filter(Boolean).join(" · ") || "Form not known yet"} · </span>
                      <span className="font-mono">{c.receiptMasked}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div>
                <button type="submit" className={btn}>
                  Add selected cases
                </button>
              </div>
            </form>
          </details>
        )}
      </section>

      <section aria-labelledby="matter-tasks-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="matter-tasks-h" className="text-lg font-semibold">
            Open tasks
          </h2>
          <Link href={`/firm/tasks/new?matter=${matter.id}`} className={btn}>
            New task
          </Link>
        </div>
        {tasks && tasks.tasks.length > 0 ? (
          <TaskTable tasks={tasks.tasks} today={tasks.today} back={back} compact />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">No open tasks for this matter or its cases.</p>
        )}
      </section>

      <section aria-labelledby="matter-details-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="matter-details-h" className="text-lg font-semibold">
          Details
        </h2>
        <MatterForm mode="edit" matterId={matter.id} initial={{ name: matter.name, kind: matter.kind, description: matter.description ?? "" }} kinds={KINDS} />
      </section>

      {isManager && (
        <form action={archiveMatterAction} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4 text-sm">
          <input type="hidden" name="matterId" value={matter.id} />
          <input type="hidden" name="archive" value={matter.archivedAt ? "0" : "1"} />
          <span className="text-[var(--muted)]">{matter.archivedAt ? "Restore this matter to add cases again." : "Archiving hides the matter from pickers. Its cases stay in it and keep being tracked."}</span>
          <button type="submit" className={btn}>
            {matter.archivedAt ? "Restore matter" : "Archive matter"}
          </button>
        </form>
      )}
    </div>
  );
}
