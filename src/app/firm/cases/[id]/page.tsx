import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStatusPanel, ObservedChanges, UscisHistory, USCIS_SOURCE_NOTE } from "@/components/case-status";
import { LineMapSection } from "@/components/line-map";
import { InsightsLink } from "@/components/case-insights";
import { ChecklistLink } from "@/components/checklist-link";
import { checklistForForm } from "@/lib/checklists";
import { caseJourney } from "@/lib/journeys";
import { LocalTime } from "@/components/local-time";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { firmAlertService, firmCaseService, documentRequestService, firmDocumentService, firmMatterService, firmService, firmTagService, firmTaskService } from "@/lib/firms";
import { setCasesMatterAction } from "../../matters/actions";
import { DOC_NOTICES, DocumentTable } from "../../documents/document-table";
import { DocumentUploadForm } from "../../documents/upload-form";
import { ACCEPT, DOCUMENT_KINDS, DOCUMENT_VISIBILITY } from "@/lib/firms/documents";

import { TaskTable } from "../../tasks/task-list";
import { setCaseAssigneeAction } from "../actions";
import { DEADLINE_KINDS, suggestedDeadline } from "@/lib/firms/alerts";
import { AddDeadlineForm } from "../../deadlines/add-deadline-form";
import { DEADLINE_NOTICES, DeadlineList } from "../../deadlines/deadline-list";
import { CaseTagsPanel } from "@/components/tag-forms";
import { flatTags } from "@/lib/cases/tags";
import { FIRM_TAG_LIMITS } from "@/lib/firms/tags";
import { addFirmCaseTagAction, toggleFirmCaseTagAction } from "../../tags/actions";
import { firmConsentLabel } from "@/lib/firms/consent";
import { getUscisClient } from "@/lib/uscis";
import { FirmRefreshButton, RecordConsentForm, RemoveFirmCaseForm, WithdrawConsentForm } from "../forms";

export const metadata: Metadata = { title: "Firm case · CasePingo" };

const NOTICES: Record<string, string> = {
  added: "Case added. We checked it with USCIS right away.",
  "consent-withdrawn": "Consent withdrawn. We've stopped checking this case.",
  "consent-recorded": "Consent recorded. Automatic checks are back on.",
  ...DEADLINE_NOTICES,
  assigned: "Case reassigned. Its open inbox items moved with it.",
  "matter-same": "No change: already in that matter.",
  "matter-moved": "Matter updated.",
};
const who = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email) : "a former team member");

export default async function FirmCasePage({ params, searchParams }: PageProps<"/firm/cases/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/cases/${id}`);
  const data = await firmCaseService().getCase(user.id, id);
  if (!data) notFound(); // also for other firms' cases: no existence leak
  const { ctx, case: c } = data;
  const allTags = (await firmTagService().list(user.id))?.tags ?? [];
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const es = user.locale === "es";
  const active = c.consents.find((x) => !x.withdrawnAt);
  const canRemove = ctx.membership.role !== "STAFF";
  const journey = caseJourney(c);
  const team = await firmService().listTeam(user.id);
  const members = (team?.members ?? []).map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email }));
  const caseTasks = await firmTaskService().list(user.id, { scope: "team", status: "all", caseId: c.id });
  const matters = await firmMatterService().options(ctx.firm.id);
  const docs = await firmDocumentService().list(user.id, { caseId: c.id });
  const requests = await documentRequestService().list(user.id, { status: "OPEN", caseId: c.id });
  const docNotice = typeof notice === "string" ? DOC_NOTICES[notice] : undefined;
  const alerts = firmAlertService();
  const deadlines = await alerts.caseDeadlines(ctx.firm.id, c.id);
  const today = alerts.today(ctx.firm.timeZone);
  const suggested = suggestedDeadline(c.statusTitleEn);
  const showPrompt = suggested && !deadlines.some((d) => d.kind === suggested && !d.doneAt);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link href="/firm/cases" className="text-sm underline underline-offset-2">
        ← Cases
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          Client:{" "}
          {c.client ? (
            <Link href={`/firm/clients/${c.client.id}`} className="underline underline-offset-2">
              {c.client.displayName}
            </Link>
          ) : (
            "None"
          )}
          {c.client?.externalRef && <span className="text-[var(--muted)]"> · {c.client.externalRef}</span>}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.nickname ?? c.receiptMasked}</h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          {c.nickname ? `${c.formType ? `${c.formType} · ` : ""}${c.receiptMasked}` : (c.formType ?? "")}
        </p>
      </div>
      <form action={setCaseAssigneeAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
        <input type="hidden" name="caseId" value={c.id} />
        <input type="hidden" name="back" value={`/firm/cases/${c.id}`} />
        <label htmlFor="case-assignee" className="font-medium">
          Assigned to
        </label>
        <select id="case-assignee" name="assigneeId" defaultValue={c.assignee?.id ?? ""} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 font-medium hover:border-[var(--accent)]">
          Save
        </button>
        <span className="text-[var(--muted)]">Updates, alerts and reminders for this case go to this person.</span>
      </form>
      <form action={setCasesMatterAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
        <input type="hidden" name="caseIds" value={c.id} />
        <input type="hidden" name="back" value={`/firm/cases/${c.id}`} />
        <label htmlFor="case-matter" className="font-medium">
          Matter
        </label>
        <select id="case-matter" name="matterId" defaultValue={c.matter?.id ?? ""} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
          <option value="">No matter</option>
          {c.matter && !matters.some((m) => m.id === c.matter!.id) && <option value={c.matter.id}>{c.matter.name} (archived)</option>}
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 font-medium hover:border-[var(--accent)]">
          Save
        </button>
        {c.matter && (
          <Link href={`/firm/matters/${c.matter.id}`} className="font-medium text-[var(--accent)] hover:underline">
            Open matter
          </Link>
        )}
      </form>
      <ModeBanner mode={getUscisClient().mode} />
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      {!active && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          Consent is withdrawn, so this case isn&apos;t being checked. Record consent below to turn checks back on.
        </p>
      )}

      <CaseStatusPanel
        c={c}
        es={es}
        guideCollapsed
        journey={journey}
        actions={active ? <FirmRefreshButton caseId={c.id} /> : undefined}
        footnote={
          <>
            Firm cases are checked automatically about twice a day. Changes go to {c.assignee ? `${who(c.assignee)}'s` : "the firm's"} Inbox; each person chooses their own emails in{" "}
            <Link href="/firm/settings/notifications" className="underline underline-offset-2">
              My notifications
            </Link>
            . {USCIS_SOURCE_NOTE}
          </>
        }
      />
      <LineMapSection map={journey.lineMap} es={es} />
      <section aria-labelledby="deadlines-h" className="flex scroll-mt-24 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="deadlines-h" className="text-lg font-semibold">
          Deadlines
        </h2>
        {showPrompt && (
          <p role="note" className="rounded-md border border-[var(--st-action)] bg-[var(--st-action-bg)] px-3 py-2 text-sm">
            {DEADLINE_KINDS[suggested].prompt}
          </p>
        )}
        {deadlines.length > 0 ? (
          <DeadlineList items={deadlines} today={today} caseId={c.id} from="case" />
        ) : (
          !showPrompt && <p className="text-sm text-[var(--muted)]">Add dates you can&apos;t miss, like an RFE response or an interview. Your team gets a reminder in Updates before each one.</p>
        )}
        <AddDeadlineForm caseId={c.id} kinds={Object.entries(DEADLINE_KINDS).map(([value, k]) => ({ value, label: k.label }))} suggested={suggested} defaultOpen={Boolean(showPrompt) || deadlines.length === 0} />
        <p className="text-xs text-[var(--muted)]">Use the date on the USCIS notice. CasePingo doesn&apos;t calculate legal deadlines.</p>
      </section>
      <section aria-labelledby="tasks-h" className="flex scroll-mt-24 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tasks-h" className="text-lg font-semibold">
            Tasks
          </h2>
          <Link href={`/firm/tasks/new?case=${c.id}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]">
            New task
          </Link>
        </div>
        {caseTasks && caseTasks.tasks.length > 0 ? (
          <TaskTable tasks={caseTasks.tasks} today={caseTasks.today} back={`/firm/cases/${c.id}#tasks-h`} compact />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">No tasks on this case yet.</p>
        )}
      </section>
      <section aria-labelledby="docs-h" className="flex scroll-mt-24 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="docs-h" className="text-lg font-semibold">
            Documents <span className="text-base font-normal tabular-nums text-[var(--muted)]">{docs?.documents.length ?? 0}</span>
          </h2>
          <Link href={`/firm/documents/requests/new?case=${c.id}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]">
            Request documents from the client
          </Link>
        </div>
        {requests && requests.requests.length > 0 && (
          <ul className="flex flex-col gap-2">
            {requests.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm">
                <Link href={`/firm/documents/requests/${r.id}`} className="font-medium hover:underline">
                  Request: {r.title}
                </Link>
                <span className="text-xs text-[var(--muted)]">
                  {r.progress.requiredAccepted} of {r.progress.required} accepted
                  {r.progress.uploaded > 0 && <strong className="ml-2 font-semibold text-[var(--st-action)]">{r.progress.uploaded} to review</strong>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {docNotice && <p role={docNotice.error ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${docNotice.error ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--success)] text-[var(--success)]"}`}>{docNotice.text}</p>}
        {docs && docs.documents.length > 0 && <DocumentTable documents={docs.documents} back={`/firm/cases/${c.id}#docs-h`} userId={user.id} isManager={ctx.membership.role !== "STAFF"} showLink={false} />}
        {docs?.storageReady ? (
          <DocumentUploadForm accept={ACCEPT} kinds={Object.entries(DOCUMENT_KINDS).map(([value, label]) => ({ value, label }))} visibilities={Object.entries(DOCUMENT_VISIBILITY).map(([value, label]) => ({ value, label }))} fixed={{ caseId: c.id }} />
        ) : (
          <p className="text-sm text-[var(--muted)]">File storage isn&apos;t set up on this site.</p>
        )}
      </section>
      <InsightsLink href={`/firm/cases/${c.id}/insights`} es={es} />
      {checklistForForm(c.formType) && <ChecklistLink checklist={checklistForForm(c.formType)!} />}
      <CaseTagsPanel
        caseId={c.id}
        tags={allTags}
        onCase={flatTags(c.firmTags).map((tg) => tg.id)}
        toggleAction={toggleFirmCaseTagAction}
        addAction={addFirmCaseTagAction}
        manageHref="/firm/tags"
        maxName={FIRM_TAG_LIMITS.name}
        intro="Tags your whole team shares, like the attorney, the visa type or a deadline. Add the first one here."
        placeholder="e.g. Attorney: Rivera"
      />
      <ObservedChanges events={c.events} es={es} />
      <UscisHistory history={c.uscisHistory} es={es} />

      <section aria-labelledby="consent-h" className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-5">
        <h2 id="consent-h" className="text-lg font-semibold">
          Consent record
        </h2>
        <ol className="flex flex-col gap-3 text-sm">
          {c.consents.map((x) => (
            <li key={x.id} className="flex flex-col gap-0.5 border-l-2 border-[var(--border)] pl-3">
              <span className="font-medium">
                {firmConsentLabel(x.basis)}
                {x.withdrawnAt ? <span className="font-normal text-[var(--muted)]"> (withdrawn)</span> : <span className="font-normal text-[var(--success)]"> (active)</span>}
              </span>
              {x.evidenceRef && <span>Evidence on file: {x.evidenceRef}</span>}
              <span className="text-[var(--muted)]">
                Recorded by {who(x.grantedBy)}, <LocalTime iso={x.capturedAt.toISOString()} />
                {x.withdrawnAt && (
                  <>
                    {" "}
                    · withdrawn by {who(x.withdrawnBy)}, <LocalTime iso={x.withdrawnAt.toISOString()} />
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
        {active ? <WithdrawConsentForm caseId={c.id} /> : <RecordConsentForm caseId={c.id} />}
      </section>

      {canRemove && (
        <section aria-labelledby="remove-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-5">
          <h2 id="remove-h" className="text-lg font-semibold">
            Remove this case
          </h2>
          <RemoveFirmCaseForm caseId={c.id} />
        </section>
      )}
    </div>
  );
}
