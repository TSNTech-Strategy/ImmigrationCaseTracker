import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";
import { INDIVIDUAL_CONSENT_OPTIONS } from "@/lib/cases/consent";
import { getUscisClient } from "@/lib/uscis";
import { describeCadence } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { flatTags, tagService } from "@/lib/cases";
import { CaseTagsPanel } from "@/components/tag-forms";
import { addCaseTagAction, toggleCaseTagAction } from "../tags/actions";
import { TAG_LIMITS } from "@/lib/cases/tags";
import { RefreshButton, RemoveCaseForm } from "./case-actions";
import { CheckThisCaseButton } from "@/app/billing/buttons";
import { CaseStatusPanel, ObservedChanges, UscisHistory, USCIS_SOURCE_NOTE } from "@/components/case-status";
import { LineMapSection } from "@/components/line-map";
import { InsightsLink } from "@/components/case-insights";
import { ChecklistLink } from "@/components/checklist-link";
import { checklistForForm } from "@/lib/checklists";
import { caseJourney } from "@/lib/journeys";
import { ApprovalCelebration } from "@/components/approval-celebration";
import { approvalNextStep, recentApprovalAt } from "@/lib/case-insights";

export const metadata: Metadata = { title: "Case · CasePingo" };

const NOTICES: Record<string, string> = {
  added: "Case added. We checked it with USCIS right away.",
  "now-checked": "Done. We'll check this case from now on; your other case is paused.",
};

export default async function CasePage({ params, searchParams }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/cases/${id}`);
  const c = await caseService().getCase(user.id, id);
  if (!c) notFound(); // also for other people's cases — no existence leak
  const allTags = await tagService().list(user.id);

  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const es = user.locale === "es";
  const consent = c.consents.find((x) => !x.withdrawnAt);
  const consentLabel = INDIVIDUAL_CONSENT_OPTIONS.find((o) => o.basis === consent?.basis)?.label;
  const plan = (await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } }))?.plan ?? "FREE";
  const approvedAt = recentApprovalAt(c.statusTitleEn, c.events);
  const nextStep = approvedAt ? approvalNextStep(c.formType, c.statusTitleEn) : null;
  const journey = caseJourney(c);

  return (
    <>
      <Link href="/cases" className="text-sm underline underline-offset-2">
        ← My cases
      </Link>
      <div className="flex flex-col gap-1">
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

      {approvedAt && (
        <ApprovalCelebration caseId={c.id} approvedAtIso={approvedAt.toISOString()} nextStep={nextStep ? nextStep[es ? "es" : "en"] : null} es={es} />
      )}

      {c.pausedReason === "plan_limit" && (
        <section aria-labelledby="paused-h" className="flex flex-col gap-3 rounded-lg border border-[var(--danger)] bg-[var(--surface)] p-5">
          <h2 id="paused-h" className="font-semibold">
            This case is paused
          </h2>
          <p className="text-sm">
            The Free plan checks 1 case automatically. Your history is kept. Check this case instead of your other one, or{" "}
            <Link href="/settings#plan-h" className="underline underline-offset-2">
              upgrade to Premium
            </Link>{" "}
            to check up to 10.
          </p>
          <div>
            <CheckThisCaseButton caseId={c.id} />
          </div>
        </section>
      )}
      <CaseStatusPanel
        c={c}
        es={es}
        journey={journey}
        actions={c.trackingStatus === "ACTIVE" ? <RefreshButton caseId={c.id} free={plan === "FREE"} /> : undefined}
        footnote={
          plan === "FREE" ? (
            <>
              On the Free plan we don&apos;t check automatically or send alerts: press Check now (up to 3 times a day). {USCIS_SOURCE_NOTE}
            </>
          ) : (
            <>
              We check automatically {describeCadence(plan)} and email you when the status changes. {USCIS_SOURCE_NOTE}
            </>
          )
        }
      />
      <LineMapSection map={journey.lineMap} es={es} />
      <InsightsLink href={`/cases/${c.id}/insights`} es={es} />
      {checklistForForm(c.formType) && <ChecklistLink checklist={checklistForForm(c.formType)!} />}
      {FEATURES.assistant && (
        <Link
          href={`/assistant?case=${c.id}`}
          className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">Questions about this case?</span>
              <span className="text-sm text-[var(--muted)]">Ask the assistant what this status means and what usually comes next.</span>
            </span>
          </span>
          <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
      <CaseTagsPanel
        caseId={c.id}
        tags={allTags}
        onCase={flatTags(c.tags).map((tg) => tg.id)}
        toggleAction={toggleCaseTagAction}
        addAction={addCaseTagAction}
        manageHref="/cases/tags"
        maxName={TAG_LIMITS.name}
        intro="Tags group your cases, like Family or Work. Only you see them."
      />
      <ObservedChanges events={c.events} es={es} />
      <UscisHistory history={c.uscisHistory} es={es} />

      <section aria-labelledby="consent-h" className="flex flex-col gap-2 text-sm">
        <h2 id="consent-h" className="text-lg font-semibold">
          Your authorization
        </h2>
        {consent ? (
          <p>
            {consentLabel ?? "Consent given"}, confirmed <LocalTime iso={consent.capturedAt.toISOString()} />.
          </p>
        ) : (
          <p className="text-[var(--danger)]">No active consent. This case isn&apos;t being checked.</p>
        )}
      </section>

      <section aria-labelledby="remove-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-6">
        <h2 id="remove-h" className="text-lg font-semibold">
          Remove this case
        </h2>
        <RemoveCaseForm caseId={c.id} />
      </section>
    </>
  );
}
