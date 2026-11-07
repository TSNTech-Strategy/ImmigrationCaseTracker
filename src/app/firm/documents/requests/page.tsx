import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { documentRequestService } from "@/lib/firms";
import { formatDue } from "@/lib/firms/alerts";
import { EmptyState, btnPrimary, td, th } from "@/components/workspace-ui";
import { LocalTime } from "@/components/local-time";
import { DocumentsSubNav } from "../sub-nav";

export const metadata: Metadata = { title: "Document requests · CasePingo" };

const STATUS = { OPEN: "Open", COMPLETED: "Complete", CANCELED: "Canceled" } as const;

export default async function RequestsPage({ searchParams }: PageProps<"/firm/documents/requests">) {
  const user = await requireUser("/firm/documents/requests");
  const sp = await searchParams;
  const status = (["OPEN", "COMPLETED", "CANCELED", "all"] as const).find((s) => s === sp.status) ?? "OPEN";
  const data = await documentRequestService().list(user.id, { status });
  if (!data) redirect("/firm");
  const seg = "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <Link href="/firm/documents/requests/new" className={btnPrimary}>
          Request documents
        </Link>
      </div>
      <DocumentsSubNav current="requests" />
      <nav aria-label="Request status" className="flex w-fit flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
        {(["OPEN", "COMPLETED", "CANCELED", "all"] as const).map((s) => (
          <Link key={s} href={s === "OPEN" ? "/firm/documents/requests" : `/firm/documents/requests?status=${s}`} aria-current={status === s ? "page" : undefined} className={seg}>
            {s === "all" ? "All" : STATUS[s]}
          </Link>
        ))}
      </nav>
      {data.requests.length === 0 ? (
        <EmptyState title={status === "OPEN" ? "No open requests" : "Nothing here"}>
          Ask a client for documents: pick their case and CasePingo fills in the checklist for that form. They upload from their phone with a private link.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th scope="col" className={th}>Request</th>
                <th scope="col" className={th}>Client</th>
                <th scope="col" className={th}>Progress</th>
                <th scope="col" className={th}>Due</th>
                <th scope="col" className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.requests.map((r) => {
                const pct = r.progress.required ? Math.round((r.progress.requiredAccepted / r.progress.required) * 100) : 0;
                const overdue = r.status === "OPEN" && r.dueOn && r.dueOn < new Date(`${data.today}T00:00:00Z`);
                return (
                  <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                    <td className={td}>
                      <Link href={`/firm/documents/requests/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">
                        {r.sentAt ? (
                          <>
                            Emailed <LocalTime iso={r.sentAt.toISOString()} />
                          </>
                        ) : (
                          "Not emailed yet"
                        )}
                      </div>
                    </td>
                    <td className={td}>{r.client.displayName}</td>
                    <td className={`${td} min-w-[180px]`}>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true">
                          <span className="block h-full rounded-full bg-[var(--success)]" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-xs tabular-nums">
                          {r.progress.requiredAccepted} of {r.progress.required} accepted
                        </span>
                      </div>
                      {r.progress.uploaded > 0 && <div className="text-xs font-medium text-[var(--st-action)]">{r.progress.uploaded} to review</div>}
                    </td>
                    <td className={`${td} whitespace-nowrap ${overdue ? "font-semibold text-[var(--danger)]" : ""}`}>{r.dueOn ? formatDue(r.dueOn) : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className={td}>{STATUS[r.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
