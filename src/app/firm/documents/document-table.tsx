import Link from "next/link";
import type { DocumentKind, DocumentSource, DocumentVisibility } from "@prisma/client";
import { DOCUMENT_KINDS } from "@/lib/firms/documents";
import { LocalTime } from "@/components/local-time";
import { td, th } from "@/components/workspace-ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteDocumentAction, updateDocumentAction } from "./actions";

export type DocumentRow = {
  id: string;
  name: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  source: DocumentSource;
  contentType: string;
  size: number;
  createdAt: Date;
  uploadedById: string | null;
  uploadedBy: { name: string | null; email: string } | null;
  case: { id: string; receiptMasked: string; nickname: string | null } | null;
  client: { id: string; displayName: string } | null;
};

export const formatSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const viewable = (t: string) => /^(application\/pdf|image\/(png|jpeg|webp))$/.test(t);
const small = "rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]";

/** Documents as a table: name (view/download), linked case or client, kind, visibility, source, size, uploaded. */
export function DocumentTable({ documents, back, userId, isManager, showLink = true }: { documents: DocumentRow[]; back: string; userId: string; isManager: boolean; showLink?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <tr>
            <th scope="col" className={th}>Name</th>
            {showLink && <th scope="col" className={th}>Linked to</th>}
            <th scope="col" className={th}>Kind</th>
            <th scope="col" className={th}>Visibility</th>
            <th scope="col" className={th}>Size</th>
            <th scope="col" className={th}>Uploaded</th>
            <th scope="col" className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {documents.map((d) => {
            const canEdit = isManager || d.uploadedById === userId;
            return (
              <tr key={d.id} className="hover:bg-[var(--surface-2)]">
                <td className={`${td} max-w-[280px]`}>
                  <a href={`/firm/documents/${d.id}/download${viewable(d.contentType) ? "?view=1" : ""}`} target={viewable(d.contentType) ? "_blank" : undefined} rel="noopener" className="block truncate font-medium hover:underline">
                    {d.name}
                  </a>
                  <span className="text-xs text-[var(--muted)]">{d.source === "CLIENT" ? "From the client" : "From the firm"}</span>
                </td>
                {showLink && (
                  <td className={`${td} max-w-[200px] truncate`}>
                    {d.case ? (
                      <Link href={`/firm/cases/${d.case.id}`} className="hover:underline">
                        {d.client?.displayName ? `${d.client.displayName} · ` : ""}
                        <span className={d.case.nickname ? "" : "font-mono"}>{d.case.nickname ?? d.case.receiptMasked}</span>
                      </Link>
                    ) : d.client ? (
                      <Link href={`/firm/clients/${d.client.id}`} className="hover:underline">
                        {d.client.displayName}
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">Not linked</span>
                    )}
                  </td>
                )}
                <td className={`${td} whitespace-nowrap`}>{DOCUMENT_KINDS[d.kind]}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {d.visibility === "CLIENT" ? (
                    <span className="rounded bg-[var(--st-progress-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--st-progress)]">Shared with client</span>
                  ) : (
                    <span className="text-[var(--muted)]">Firm only</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums text-[var(--muted)]`}>{formatSize(d.size)}</td>
                <td className={`${td} whitespace-nowrap text-xs text-[var(--muted)]`}>
                  <LocalTime iso={d.createdAt.toISOString()} />
                  <div>{d.uploadedBy ? (d.uploadedBy.name ?? d.uploadedBy.email) : d.source === "CLIENT" ? "Client" : "Former member"}</div>
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <a href={`/firm/documents/${d.id}/download`} className={small} aria-label={`Download ${d.name}`}>
                    Download
                  </a>
                  {canEdit && d.client && (
                    <form action={updateDocumentAction} className="inline">
                      <input type="hidden" name="documentId" value={d.id} />
                      <input type="hidden" name="visibility" value={d.visibility === "CLIENT" ? "INTERNAL" : "CLIENT"} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" className={small}>
                        {d.visibility === "CLIENT" ? "Stop sharing" : "Share"}
                      </button>
                    </form>
                  )}
                  {canEdit && (
                    <form action={deleteDocumentAction} className="inline">
                      <input type="hidden" name="documentId" value={d.id} />
                      <input type="hidden" name="back" value={back} />
                      <ConfirmSubmit message={`Delete "${d.name}"? This can't be undone.`} className={`${small} hover:text-[var(--danger)]`} label={`Delete ${d.name}`}>
                        Delete
                      </ConfirmSubmit>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
