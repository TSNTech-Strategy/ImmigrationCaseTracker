import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/lib/site";
import { requireUser } from "@/lib/auth/session";
import { firmDataService, firmService } from "@/lib/firms";
import { DELETION_GRACE_DAYS } from "@/lib/firms/data";
import { LocalTime } from "@/components/local-time";
import { btn } from "@/components/workspace-ui";
import { CancelDeletionForm, DeleteWorkspaceForm } from "./forms";

export const metadata: Metadata = { title: "Legal & data · CasePingo" };

const card = "flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5";

export default async function LegalPage() {
  const user = await requireUser("/firm/settings/legal");
  const ctx = await firmService().getContext(user.id);
  if (!ctx) redirect("/firm");
  if (ctx.membership.role === "STAFF") redirect("/firm/settings");
  const isOwner = ctx.membership.role === "OWNER";
  const pending = await firmDataService().pendingDeletion(ctx.firm.id);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Legal &amp; data</h1>
        <p className="text-sm text-[var(--muted)]">Your firm&apos;s data belongs to your firm. Take a full copy, or delete everything, at any time.</p>
      </div>

      {pending && (
        <section role="alert" className="flex flex-col gap-3 rounded-lg border-2 border-[var(--danger)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--danger)]">This workspace is scheduled for deletion</h2>
          <p className="text-sm">
            Requested by {pending.requesterEmail} on <LocalTime iso={pending.requestedAt.toISOString()} />. On <LocalTime iso={pending.deleteAfter.toISOString()} /> we delete every client, case, document, task, request and log in {ctx.firm.name}. Download a copy before then if you need one.
          </p>
          {isOwner ? <CancelDeletionForm /> : <p className="text-sm text-[var(--muted)]">Only an Owner can cancel it.</p>}
        </section>
      )}

      <section aria-labelledby="export-h" className={card}>
        <h2 id="export-h" className="text-lg font-semibold">
          Export everything
        </h2>
        <p className="text-sm text-[var(--muted)]">
          One file (JSON) with your settings, team, clients (including dates of birth and A-Numbers), cases with full receipt numbers and status history, deadlines, tasks and comments, matters, tags, the list of documents, document requests and the activity log. Document files themselves download from Documents. For a spreadsheet of cases, use Export CSV on the Cases page.
        </p>
        {isOwner ? (
          <div>
            <a href="/firm/settings/legal/export" className={btn}>
              Download everything (JSON)
            </a>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Only an Owner can export everything.</p>
        )}
        <p className="text-xs text-[var(--muted)]">The file contains sensitive client details. Keep it somewhere safe. Every export is recorded in the Activity log.</p>
      </section>

      <section aria-labelledby="policy-h" className={card}>
        <h2 id="policy-h" className="text-lg font-semibold">
          How we handle your data
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>Case statuses come from USCIS&apos;s official Case Status API, only for cases with a recorded consent. We never scrape USCIS or other government sites.</li>
          <li>Receipt numbers, dates of birth, A-Numbers and every uploaded file are encrypted before they&apos;re stored.</li>
          <li>If your trial ends or your plan lapses, checks pause. Your data stays until you delete it.</li>
          <li>No advertising or tracking cookies, and we don&apos;t sell or share your data.</li>
          <li>
            Read the{" "}
            <Link href="/dpa" className="font-medium text-[var(--accent)] underline underline-offset-2">
              Data Processing Agreement
            </Link>
            ,{" "}
            <Link href="/subprocessors" className="font-medium text-[var(--accent)] underline underline-offset-2">
              Subprocessors
            </Link>
            ,{" "}
            <Link href="/privacy" className="font-medium text-[var(--accent)] underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-medium text-[var(--accent)] underline underline-offset-2">
              Terms
            </Link>
            . For a countersigned DPA or a security questionnaire, write to {SITE.contactEmail}.
          </li>
        </ul>
      </section>

      {!pending && (
        <section aria-labelledby="delete-h" className="flex flex-col gap-3 rounded-lg border border-[var(--danger)] bg-[var(--surface)] p-5">
          <h2 id="delete-h" className="text-lg font-semibold text-[var(--danger)]">
            Delete the workspace
          </h2>
          <p className="text-sm">
            Deletes every client, case, document (and its file), task, request and log in {ctx.firm.name}, for everyone on the team. You have {DELETION_GRACE_DAYS} days to change your mind; after that it can&apos;t be undone. Cancel your plan in Plan &amp; billing first.
          </p>
          {isOwner ? <DeleteWorkspaceForm firmName={ctx.firm.name} /> : <p className="text-sm text-[var(--muted)]">Only an Owner can delete the workspace.</p>}
        </section>
      )}
    </div>
  );
}
