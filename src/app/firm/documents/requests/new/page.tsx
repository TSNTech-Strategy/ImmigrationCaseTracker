import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { firmService } from "@/lib/firms";
import { itemsFromChecklist } from "@/lib/firms/requests";
import { checklistForForm } from "@/lib/checklists";
import { formInfo } from "@/lib/case-insights";
import { btn, control } from "@/components/workspace-ui";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Request documents · CasePingo" };

export default async function NewRequestPage({ searchParams }: PageProps<"/firm/documents/requests/new">) {
  const user = await requireUser("/firm/documents/requests/new");
  const ctx = await firmService().getContext(user.id);
  if (!ctx) redirect("/firm");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  let clientId = one(sp.client);
  let caseId = one(sp.case);
  // Coming from a case page: its client.
  if (caseId && !clientId) clientId = (await prisma.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { clientId: true } }))?.clientId ?? "";
  const clients = await prisma.client.findMany({ where: { firmId: ctx.firm.id, archivedAt: null }, select: { id: true, displayName: true, email: true, locale: true }, orderBy: { displayName: "asc" } });
  const client = clients.find((c) => c.id === clientId);
  const cases = client ? await prisma.trackedCase.findMany({ where: { firmId: ctx.firm.id, clientId: client.id }, select: { id: true, receiptMasked: true, nickname: true, formType: true }, orderBy: { createdAt: "desc" } }) : [];
  const theCase = cases.find((c) => c.id === caseId);
  if (!theCase) caseId = "";
  const list = theCase ? checklistForForm(theCase.formType) : null;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href="/firm/documents/requests" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Requests
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Request documents</h1>
        <p className="text-sm text-[var(--muted)]">The client gets a private link (no account needed) and uploads each document from their phone or computer. You review each one.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Client</span>
          <select name="client" defaultValue={clientId} className={control}>
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        {client && (
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-[var(--muted)]">Case (fills in its checklist)</span>
            <select name="case" defaultValue={caseId} className={control}>
              <option value="">No case</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {[formInfo(c.formType)?.code, c.nickname, c.receiptMasked].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className={btn}>
          {client ? "Load checklist" : "Continue"}
        </button>
      </form>

      {client && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <RequestForm
            key={`${client.id}-${caseId}`}
            clientId={client.id}
            caseId={caseId}
            checklist={theCase ? itemsFromChecklist(theCase.formType).map((i) => ({ label: i.label, labelEs: i.labelEs ?? null, note: i.note ?? null, required: i.required !== false })) : []}
            checklistTitle={list ? list.title.en : null}
            canEmail={Boolean(client.email)}
            defaultTitle={client.locale === "es" ? (list ? `Documentos para su ${list.form}` : "Documentos para su caso") : list ? `Documents for your ${list.form}` : "Documents for your case"}
          />
        </section>
      )}
    </div>
  );
}
