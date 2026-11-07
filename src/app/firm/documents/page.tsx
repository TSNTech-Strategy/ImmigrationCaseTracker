import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmDocumentService } from "@/lib/firms";
import { ACCEPT, DOCUMENT_KINDS, DOCUMENT_VISIBILITY } from "@/lib/firms/documents";
import { EmptyState, Notice, btn, control } from "@/components/workspace-ui";
import { taskFormOptions } from "../tasks/options";
import { DOC_NOTICES, DocumentTable } from "./document-table";
import { DocumentUploadForm } from "./upload-form";
import { DocumentsSubNav } from "./sub-nav";

export const metadata: Metadata = { title: "Documents · CasePingo" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const opts = (r: Record<string, string>) => Object.entries(r).map(([value, label]) => ({ value, label }));

export default async function DocumentsPage({ searchParams }: PageProps<"/firm/documents">) {
  const user = await requireUser("/firm/documents");
  const sp = await searchParams;
  const filters = { scope: (["case", "client", "unlinked"] as const).find((s) => s === one(sp.scope)), kind: one(sp.kind), visibility: one(sp.visibility), source: one(sp.source), q: one(sp.q) };
  const data = await firmDocumentService().list(user.id, filters);
  if (!data) redirect("/firm");
  const options = await taskFormOptions(data.ctx.firm.id);
  const filtered = Boolean(filters.scope || filters.kind || filters.visibility || filters.source || filters.q);
  const notice = one(sp.notice);
  const isManager = data.ctx.membership.role !== "STAFF";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <span className="text-sm tabular-nums text-[var(--muted)]">{data.documents.length}</span>
        </div>
        <Link href="/firm/documents/requests/new" className={btn}>
          Request documents from a client
        </Link>
      </div>
      <DocumentsSubNav current="files" />
      {notice && DOC_NOTICES[notice] && <Notice kind={DOC_NOTICES[notice].error ? "error" : "success"}>{DOC_NOTICES[notice].text}</Notice>}
      {!data.storageReady && <Notice kind="error">File storage isn&apos;t set up on this site, so uploads are off here.</Notice>}

      {data.storageReady && (
        <DocumentUploadForm accept={ACCEPT} kinds={opts(DOCUMENT_KINDS)} visibilities={opts(DOCUMENT_VISIBILITY)} cases={options.cases} clients={options.clients} defaultOpen={data.documents.length === 0} />
      )}

      <form method="get" role="search" aria-label="Filter documents" className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <label>
          <span className="sr-only">Search</span>
          <input name="q" type="search" defaultValue={filters.q} placeholder="Search: file, client, case" className={control} />
        </label>
        <label>
          <span className="sr-only">Linked to</span>
          <select name="scope" defaultValue={filters.scope ?? ""} className={control}>
            <option value="">Linked to: anything</option>
            <option value="case">A case</option>
            <option value="client">A client only</option>
            <option value="unlinked">Not linked</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Kind</span>
          <select name="kind" defaultValue={filters.kind ?? ""} className={control}>
            <option value="">Kind: all</option>
            {opts(DOCUMENT_KINDS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Visibility</span>
          <select name="visibility" defaultValue={filters.visibility ?? ""} className={control}>
            <option value="">Visibility: any</option>
            {opts(DOCUMENT_VISIBILITY).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Source</span>
          <select name="source" defaultValue={filters.source ?? ""} className={control}>
            <option value="">Source: any</option>
            <option value="FIRM">From the firm</option>
            <option value="CLIENT">From clients</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className={btn}>
            Apply
          </button>
          {filtered && (
            <Link href="/firm/documents" className="px-1 text-sm font-medium text-[var(--accent)] hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {data.documents.length === 0 ? (
        <EmptyState title={filtered ? "No documents match" : "No documents yet"}>
          {filtered ? "Try another filter." : "Upload passports, USCIS notices and evidence. Each file is stored encrypted and stays with its case or client."}
        </EmptyState>
      ) : (
        <DocumentTable documents={data.documents} back="/firm/documents" userId={user.id} isManager={isManager} />
      )}
    </>
  );
}
