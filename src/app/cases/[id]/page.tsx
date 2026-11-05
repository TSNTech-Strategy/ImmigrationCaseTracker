import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";
import { INDIVIDUAL_CONSENT_OPTIONS } from "@/lib/cases/consent";
import { checkFailureMessage } from "@/lib/cases/policy";
import { getUscisClient } from "@/lib/uscis";
import { describeCadence } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { RefreshButton, RemoveCaseForm } from "./case-actions";

export const metadata: Metadata = { title: "Case · CasePingo" };

type HistoryItem = { date?: { raw?: string } | null; textEn?: string | null; textEs?: string | null };

const NOTICES: Record<string, string> = { added: "Case added. We checked it with USCIS right away." };

export default async function CasePage({ params, searchParams }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/cases/${id}`);
  const c = await caseService().getCase(user.id, id);
  if (!c) notFound(); // also for other people's cases — no existence leak

  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const es = user.locale === "es";
  const primary = { title: es ? c.statusTitleEs : c.statusTitleEn, desc: es ? c.statusDescriptionEs : c.statusDescriptionEn };
  const secondary = { title: es ? c.statusTitleEn : c.statusTitleEs, desc: es ? c.statusDescriptionEn : c.statusDescriptionEs };
  const history = (Array.isArray(c.uscisHistory) ? c.uscisHistory : []) as HistoryItem[];
  const consent = c.consents.find((x) => !x.withdrawnAt);
  const consentLabel = INDIVIDUAL_CONSENT_OPTIONS.find((o) => o.basis === consent?.basis)?.label;
  const failed = c.lastCheckOutcome && c.lastCheckOutcome !== "ok";
  const plan = (await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } }))?.plan ?? "FREE";

  return (
    <>
      <Link href="/cases" className="text-sm underline underline-offset-2">
        ← My cases
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{c.nickname ?? c.receiptMasked}</h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          {c.formType ? `${c.formType} · ` : ""}
          {c.receiptMasked}
        </p>
      </div>
      <ModeBanner mode={getUscisClient().mode} />
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}

      <section aria-labelledby="status-h" className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 id="status-h" className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Current status
        </h2>
        <p className="text-2xl font-semibold">{primary.title ?? "Not checked yet"}</p>
        {primary.desc && <p className="leading-relaxed">{primary.desc}</p>}
        {secondary.title && (
          <details className="text-sm">
            <summary className="cursor-pointer underline underline-offset-2">{es ? "View in English" : "Ver en español"}</summary>
            <p className="mt-2 font-medium">{secondary.title}</p>
            {secondary.desc && <p className="mt-1 leading-relaxed">{secondary.desc}</p>}
          </details>
        )}
        {failed && (
          <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
            Last check didn&apos;t succeed: {checkFailureMessage(c.lastCheckOutcome!)}
          </p>
        )}
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Last checked with USCIS</dt>
            <dd>
              <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Last status change we saw</dt>
            <dd>
              <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="None yet" />
            </dd>
          </div>
          {c.uscisModifiedRaw && (
            <div>
              <dt className="text-[var(--muted)]">USCIS last updated (as reported)</dt>
              <dd>{c.uscisModifiedRaw}</dd>
            </div>
          )}
          {c.uscisSubmittedRaw && (
            <div>
              <dt className="text-[var(--muted)]">Submitted (as reported)</dt>
              <dd>{c.uscisSubmittedRaw}</dd>
            </div>
          )}
        </dl>
        <RefreshButton caseId={c.id} />
        <p className="text-xs text-[var(--muted)]">
          We check automatically {describeCadence(plan)} and email you when the status changes. USCIS is the authoritative source:{" "}
          <a href="https://egov.uscis.gov/" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            USCIS Case Status Online
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="observed-h" className="flex flex-col gap-3">
        <h2 id="observed-h" className="text-lg font-semibold">
          Changes we&apos;ve seen
        </h2>
        {c.events.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 border-l border-[var(--border)] pl-4">
            {c.events.map((e) => (
              <li key={e.id} className="flex flex-col">
                <span className="font-medium">{(es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn ?? "Status recorded"}</span>
                <span className="text-xs text-[var(--muted)]">
                  First seen <LocalTime iso={e.firstObservedAt.toISOString()} />
                  {e.uscisReportedRaw ? ` · USCIS date ${e.uscisReportedRaw}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-h" className="flex flex-col gap-3">
          <h2 id="history-h" className="text-lg font-semibold">
            History reported by USCIS
          </h2>
          <ol className="flex flex-col gap-2 border-l border-[var(--border)] pl-4">
            {history.map((h, i) => (
              <li key={i} className="flex flex-col">
                <span className="font-medium">{(es ? h.textEs : h.textEn) ?? h.textEn ?? "—"}</span>
                {h.date?.raw && <span className="text-xs text-[var(--muted)]">{h.date.raw}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

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

      <section aria-labelledby="remove-h" className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-6">
        <h2 id="remove-h" className="text-lg font-semibold">
          Remove this case
        </h2>
        <RemoveCaseForm caseId={c.id} />
      </section>
    </>
  );
}
