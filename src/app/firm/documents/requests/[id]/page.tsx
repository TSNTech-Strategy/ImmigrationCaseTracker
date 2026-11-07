import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { documentRequestService } from "@/lib/firms";
import { formatDue } from "@/lib/firms/alerts";
import { progressOf } from "@/lib/firms/requests";
import { LocalTime } from "@/components/local-time";
import { CopyLink } from "@/components/copy-link";
import { Notice, btn, btnPrimary } from "@/components/workspace-ui";
import { formatSize } from "../../document-table";
import { requestAction } from "../actions";

export const metadata: Metadata = { title: "Document request · CasePingo" };

const NOTICES: Record<string, { text: string; error?: boolean }> = {
  created: { text: "Request created. Copy the link below or email it to the client." },
  sent: { text: "Emailed to the client." },
  "created-not-sent": { text: "Request created, but it couldn't be emailed. Add the client's email address, or copy the link.", error: true },
  "send-error": { text: "Couldn't email it. Add the client's email address, or copy the link and send it yourself.", error: true },
  "new-link": { text: "New link made. The old link no longer works." },
  canceled: { text: "Request canceled. The link no longer works." },
  reopened: { text: "Request reopened. Make a new link to send it again." },
  accepted: { text: "Accepted." },
  rejected: { text: "Sent back to the client with your reason." },
  completed: { text: "Every required document is accepted. The request is complete." },
  "reason-needed": { text: "Say what's wrong so the client knows what to upload.", error: true },
  error: { text: "That didn't work. Try again.", error: true },
};
const ITEM: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Waiting for the client", cls: "bg-[var(--surface-2)] text-[var(--muted)]" },
  UPLOADED: { label: "Ready to review", cls: "bg-[var(--st-action-bg)] text-[var(--st-action)]" },
  ACCEPTED: { label: "Accepted", cls: "bg-[var(--st-done-bg)] text-[var(--st-done)]" },
  REJECTED: { label: "Asked again", cls: "bg-[var(--st-stop-bg)] text-[var(--st-stop)]" },
};

function Op({ id, op, children, primary, itemId }: { id: string; op: string; children: string; primary?: boolean; itemId?: string }) {
  return (
    <form action={requestAction}>
      <input type="hidden" name="requestId" value={id} />
      <input type="hidden" name="op" value={op} />
      {itemId && <input type="hidden" name="itemId" value={itemId} />}
      <button type="submit" className={primary ? btnPrimary : btn}>
        {children}
      </button>
    </form>
  );
}

export default async function RequestPage({ params, searchParams }: PageProps<"/firm/documents/requests/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/documents/requests/${id}`);
  const data = await documentRequestService().get(user.id, id);
  if (!data) notFound();
  const { request: r, link } = data;
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const p = progressOf(r.items);
  const open = r.status === "OPEN";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href="/firm/documents/requests" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Requests
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--muted)]">
          {r.status === "OPEN" ? "Open request" : r.status === "COMPLETED" ? "Complete" : "Canceled"} ·{" "}
          <Link href={`/firm/clients/${r.client.id}`} className="hover:underline">
            {r.client.displayName}
          </Link>
          {r.case && (
            <>
              {" · "}
              <Link href={`/firm/cases/${r.case.id}`} className="hover:underline">
                {r.case.nickname ?? r.case.receiptMasked}
              </Link>
            </>
          )}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
        <p className="text-sm text-[var(--muted)]">
          {p.requiredAccepted} of {p.required} required accepted{p.uploaded ? ` · ${p.uploaded} ready to review` : ""}
          {r.dueOn ? ` · due ${formatDue(r.dueOn)}` : ""}
          {r.sentAt ? (
            <>
              {" · emailed "}
              <LocalTime iso={r.sentAt.toISOString()} />
            </>
          ) : (
            " · not emailed yet"
          )}
        </p>
      </div>
      {notice && <Notice kind={notice.error ? "error" : "success"}>{notice.text}</Notice>}

      {open && (
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <CopyLink url={link} label="Upload link for the client (private: no sign-in needed)" />
          <div className="flex flex-wrap gap-2">
            <Op id={r.id} op="send" primary>
              {r.sentAt ? "Email it again" : "Email it to the client"}
            </Op>
            <Op id={r.id} op="new-link">
              Make a new link
            </Op>
          </div>
          {!r.client.email && <p className="text-xs text-[var(--muted)]">This client has no email address: copy the link and send it by text or WhatsApp.</p>}
        </section>
      )}
      {r.message && <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm whitespace-pre-line">{r.message}</p>}

      <section aria-labelledby="items-h" className="flex flex-col gap-3">
        <h2 id="items-h" className="text-lg font-semibold">
          Documents
        </h2>
        <ol className="flex flex-col gap-3">
          {r.items.map((it) => (
            <li key={it.id} className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {it.label}
                    {!it.required && <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">(if it applies)</span>}
                  </p>
                  {it.note && <p className="text-xs text-[var(--muted)]">{it.note}</p>}
                </div>
                <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${ITEM[it.status]!.cls}`}>{ITEM[it.status]!.label}</span>
              </div>
              {it.documents.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {it.documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface-2)] px-3 py-2">
                      <a href={`/firm/documents/${d.id}/download${/^(application\/pdf|image\/(png|jpeg|webp))$/.test(d.contentType) ? "?view=1" : ""}`} target="_blank" rel="noopener" className="min-w-0 truncate font-medium hover:underline">
                        {d.name}
                      </a>
                      <span className="text-xs text-[var(--muted)]">
                        {formatSize(d.size)} · <LocalTime iso={d.createdAt.toISOString()} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {it.status === "REJECTED" && it.rejectReason && <p className="text-sm text-[var(--danger)]">Asked again: {it.rejectReason}</p>}
              {r.status === "OPEN" && (it.status === "UPLOADED" || it.status === "REJECTED" || (it.status === "ACCEPTED" && it.documents.length > 0)) && (
                <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
                  {it.status !== "ACCEPTED" && it.documents.length > 0 && (
                    <Op id={r.id} op="accept" itemId={it.id} primary>
                      Accept
                    </Op>
                  )}
                  <form action={requestAction} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="op" value="reject" />
                    <input type="hidden" name="itemId" value={it.id} />
                    <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-[var(--muted)]">
                      Ask again because…
                      <input name="reason" maxLength={300} placeholder="e.g. The photo is blurry; please include all pages" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--foreground)]" />
                    </label>
                    <button type="submit" className={btn}>
                      Ask again
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4 text-sm">
        <span className="text-[var(--muted)]">{open ? "Canceling stops the link from working. Uploaded files stay in Documents." : r.status === "CANCELED" ? "Reopen to ask the client again." : "This request is complete."}</span>
        {open ? (
          <Op id={r.id} op="cancel">
            Cancel request
          </Op>
        ) : r.status === "CANCELED" ? (
          <Op id={r.id} op="reopen">
            Reopen
          </Op>
        ) : null}
      </div>
    </div>
  );
}
