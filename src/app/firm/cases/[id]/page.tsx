import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStatusPanel, ObservedChanges, UscisHistory, USCIS_SOURCE_NOTE } from "@/components/case-status";
import { LineMapSection } from "@/components/line-map";
import { InsightsLink } from "@/components/case-insights";
import { caseJourney } from "@/lib/journeys";
import { LocalTime } from "@/components/local-time";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmTagService } from "@/lib/firms";
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

  return (
    <>
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
            Firm cases are checked automatically about twice a day. {who(c.addedBy)} gets an email when the status changes. {USCIS_SOURCE_NOTE}
          </>
        }
      />
      <LineMapSection map={journey.lineMap} es={es} />
      <InsightsLink href={`/firm/cases/${c.id}/insights`} es={es} />
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
    </>
  );
}
