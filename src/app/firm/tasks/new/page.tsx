import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { TaskForm } from "../task-form";
import { taskFormOptions } from "../options";

export const metadata: Metadata = { title: "New task · CasePingo" };

export default async function NewTaskPage({ searchParams }: PageProps<"/firm/tasks/new">) {
  const user = await requireUser("/firm/tasks/new");
  const ctx = await firmService().getContext(user.id);
  if (!ctx) redirect("/firm");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const options = await taskFormOptions(ctx.firm.id);
  const caseId = options.cases.some((c) => c.value === one(sp.case)) ? one(sp.case) : "";
  const clientId = options.clients.some((c) => c.value === one(sp.client)) ? one(sp.client) : "";
  const matterId = options.matters.some((m) => m.value === one(sp.matter)) ? one(sp.matter) : "";
  const back = matterId ? `/firm/matters/${matterId}` : caseId ? `/firm/cases/${caseId}` : clientId ? `/firm/clients/${clientId}` : "/firm/tasks";
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href={back} className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New task</h1>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <TaskForm
          mode="create"
          initial={{ title: "", description: "", status: "TODO", type: one(sp.type) || "GENERAL", priority: "NONE", dueOn: one(sp.due), assigneeId: user.id, caseId, clientId, matterId }}
          {...options}
        />
      </section>
    </div>
  );
}
