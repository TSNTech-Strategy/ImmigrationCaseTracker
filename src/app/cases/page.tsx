import Link from "next/link";
import type { Metadata } from "next";
import { CaseTable } from "@/components/case-table";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { caseService } from "@/lib/cases";
import { getUscisClient } from "@/lib/uscis";
import { ApprovalBanners } from "@/components/approval-celebration";
import { TagChip } from "@/components/case-tags";
import { flatTags, type TagColor } from "@/lib/cases";
import { recentApprovalAt } from "@/lib/case-insights";
import { caseJourney } from "@/lib/journeys";
import { COMPLETED_PREVIEW, GROUP_ORDER, caseGlance, glanceCounts, matchesFilter, parseCaseFilter, type CaseFilter, type CaseGroup } from "@/lib/my-cases";
import { CasesTabs, SummaryTiles, TILE_LABEL } from "@/components/my-cases-ui";
import { checklistForForm, checklistPath, checklistProgress } from "@/lib/checklists";
import { createChecklistService } from "@/lib/checklists-service";

export const metadata: Metadata = { title: "My cases · CasePingo" };

const GROUP_TITLE: Record<CaseGroup, { en: string; es: string }> = {
  attention: { en: "Needs attention", es: "Requieren atención" },
  progress: { en: "In progress", es: "En proceso" },
  completed: { en: "Completed", es: "Terminados" },
};

const NOTICES: Record<string, string> = {
  "password-updated": "Your password was updated.",
  removed: "The case was removed. We've stopped checking it.",
};

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await requireUser("/cases");
  const { notice, tag, show } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const now = new Date();
  const [rows, ticked] = await Promise.all([caseService().listCases(user.id), createChecklistService({ db: prisma }).all(user.id)]);
  // Each case with its line map, group (needs attention, in progress, completed), tiles, next step,
  // and either Share my journey (approved) or how ready its documents are (in progress).
  const cases = rows.map((c) => {
    const journey = caseJourney(c, now);
    const observedApprovalAt = recentApprovalAt(c.statusTitleEn, c.events, now);
    const approved = journey.lineMap.outcome === "approved";
    const cl = checklistForForm(c.formType);
    const p = cl && !approved && !journey.lineMap.finished ? checklistProgress(cl, ticked.get(cl.key) ?? []) : null;
    return {
      ...c,
      tags: flatTags(c.tags),
      journey,
      observedApprovalAt,
      ...caseGlance(c, journey, { now, observedApprovalAt }),
      approvedHref: approved ? `/cases/${c.id}/approved` : null,
      docs: cl && p && p.required > 0 ? { href: checklistPath(cl.key), pct: Math.round((p.requiredDone / p.required) * 100) } : null,
    };
  });
  // Tags on any case, A to Z, with how many cases have each: the filter.
  const inUse = new Map<string, { id: string; name: string; color: TagColor; count: number }>();
  for (const c of cases) for (const tg of c.tags) inUse.set(tg.id, { ...tg, count: (inUse.get(tg.id)?.count ?? 0) + 1 });
  const tagFilter = [...inUse.values()].sort((a, b) => a.name.localeCompare(b.name));
  const activeTag = typeof tag === "string" && inUse.has(tag) ? tag : null;
  const filter = parseCaseFilter(show);
  const counts = glanceCounts(cases);
  const tagged = activeTag ? cases.filter((c) => c.tags.some((tg) => tg.id === activeTag)) : cases;
  const shown = filter ? tagged.filter((c) => matchesFilter(c, filter)) : tagged;
  /** /cases with a tag and/or a tile, keeping whichever isn't changing. */
  const hrefWith = (f: CaseFilter | null, t: string | null = activeTag) => {
    const q = new URLSearchParams();
    if (t) q.set("tag", t);
    if (f) q.set("show", f);
    return q.size ? `/cases?${q}` : "/cases";
  };
  // Sections: the newest updates first among completed cases, which fold away after a few unless a filter is on.
  const sections = GROUP_ORDER.map((group) => {
    const rows = shown.filter((c) => c.group === group);
    if (group === "completed") rows.sort((a, b) => (b.journey.days.lastUpdate ?? "").localeCompare(a.journey.days.lastUpdate ?? ""));
    const fold = group === "completed" && !filter && !activeTag && rows.length > COMPLETED_PREVIEW;
    return { group, rows, visible: fold ? rows.slice(0, COMPLETED_PREVIEW) : rows, fold };
  }).filter((sec) => sec.rows.length > 0);
  const mode = getUscisClient().mode;
  const preferEs = user.locale === "es";
  const lang = preferEs ? "es" : "en";
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, trialEndsAt: true } });
  const approved = cases.filter((c) => c.observedApprovalAt).map((c) => ({ id: c.id, name: c.nickname ?? c.receiptMasked, href: `/cases/${c.id}` }));
  const trialDays = account?.trialEndsAt && account.trialEndsAt > now ? Math.ceil((account.trialEndsAt.getTime() - now.getTime()) / 86_400_000) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <Link href="/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Add a case
        </Link>
      </div>
      <CasesTabs current="uscis" es={preferEs} />
      <ModeBanner mode={mode} />
      {approved.length > 0 && <ApprovalBanners cases={approved} es={preferEs} />}
      {trialDays > 0 ? (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          <span>
            <strong>Premium trial: {trialDays} day{trialDays === 1 ? "" : "s"} left.</strong> We check your cases automatically and email you when they change.
          </span>
          <Link href="/settings#plan-h" className="font-semibold text-[var(--accent)] hover:underline">
            Keep Premium
          </Link>
        </p>
      ) : (
        account?.plan === "FREE" && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
            <span>Free plan: we don&apos;t check automatically or send alerts. Open your case and press Check now.</span>
            <Link href="/settings#plan-h" className="font-semibold text-[var(--accent)] hover:underline">
              Get automatic checks
            </Link>
          </p>
        )
      )}
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}

      {cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="font-medium">You aren&apos;t tracking any cases yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add the receipt number from your USCIS notice (for example EAC9999103402) to start.
          </p>
        </div>
      ) : (
        <>
          <SummaryTiles counts={counts} active={filter} hrefFor={(f) => hrefWith(f)} es={preferEs} />
          <nav aria-label="Filter by tag" className="flex flex-wrap items-center gap-2">
            {tagFilter.length > 0 && (
              <>
                <span className="text-sm text-[var(--muted)]">Tags:</span>
                <Link href={hrefWith(filter, null)} aria-current={activeTag ? undefined : "page"} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${activeTag ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"}`}>
                    All {cases.length}
                  </span>
                </Link>
                {tagFilter.map((tg) => (
                  <Link
                    key={tg.id}
                    href={hrefWith(filter, activeTag === tg.id ? null : tg.id)}
                    aria-current={activeTag === tg.id ? "page" : undefined}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <TagChip tag={tg} count={tg.count} selected={activeTag === tg.id} />
                  </Link>
                ))}
              </>
            )}
            <Link href="/cases/tags" className={`text-sm font-medium text-[var(--accent)] hover:underline ${tagFilter.length ? "ml-auto" : ""}`}>
              {tagFilter.length ? "Manage tags" : "Group cases with tags"}
            </Link>
          </nav>
          {filter && (
            <p role="status" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <strong className="font-semibold">
                {TILE_LABEL[filter][lang]}: {shown.length} {preferEs ? (shown.length === 1 ? "caso" : "casos") : shown.length === 1 ? "case" : "cases"}
              </strong>
              <Link href={hrefWith(null)} className="font-medium text-[var(--accent)] hover:underline">
                {preferEs ? "Ver todos los casos" : "Show all cases"}
              </Link>
            </p>
          )}
          {shown.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
              {preferEs ? "No hay casos aquí por ahora." : "No cases here right now."}
            </p>
          )}
          {sections.map((sec) => (
            <section key={sec.group} aria-labelledby={`group-${sec.group}`} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 id={`group-${sec.group}`} className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {GROUP_TITLE[sec.group][lang]}
                </h2>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold tabular-nums">{sec.rows.length}</span>
                {sec.fold && (
                  <Link href={hrefWith("completed")} className="ml-auto text-sm font-medium text-[var(--accent)] hover:underline">
                    {preferEs ? `Ver los ${sec.rows.length}` : `View all ${sec.rows.length}`}
                  </Link>
                )}
              </div>
              <CaseTable rows={sec.visible} hrefBase="/cases" es={preferEs} fixed />
            </section>
          ))}
        </>
      )}
    </>
  );
}
