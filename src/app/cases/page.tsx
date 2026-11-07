import Link from "next/link";
import type { Metadata } from "next";
import { CaseTable } from "@/components/case-table";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { caseService } from "@/lib/cases";
import { getUscisClient } from "@/lib/uscis";
import { recentApprovals } from "@/lib/cases/approvals";
import { ApprovalBanners } from "@/components/approval-celebration";
import { TagChip } from "@/components/case-tags";
import { flatTags, type TagColor } from "@/lib/cases";

export const metadata: Metadata = { title: "My cases · CasePingo" };

const NOTICES: Record<string, string> = {
  "password-updated": "Your password was updated.",
  removed: "The case was removed. We've stopped checking it.",
};

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await requireUser("/cases");
  const { notice, tag } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const cases = (await caseService().listCases(user.id)).map((c) => ({ ...c, tags: flatTags(c.tags) }));
  // Tags on any case, A to Z, with how many cases have each: the filter.
  const inUse = new Map<string, { id: string; name: string; color: TagColor; count: number }>();
  for (const c of cases) for (const tg of c.tags) inUse.set(tg.id, { ...tg, count: (inUse.get(tg.id)?.count ?? 0) + 1 });
  const tagFilter = [...inUse.values()].sort((a, b) => a.name.localeCompare(b.name));
  const activeTag = typeof tag === "string" && inUse.has(tag) ? tag : null;
  const shown = activeTag ? cases.filter((c) => c.tags.some((tg) => tg.id === activeTag)) : cases;
  const mode = getUscisClient().mode;
  const preferEs = user.locale === "es";
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, trialEndsAt: true } });
  const now = new Date();
  const approvals = await recentApprovals(prisma, cases, now);
  const approved = cases.filter((c) => approvals.has(c.id)).map((c) => ({ id: c.id, name: c.nickname ?? c.receiptMasked, href: `/cases/${c.id}` }));
  const trialDays = account?.trialEndsAt && account.trialEndsAt > now ? Math.ceil((account.trialEndsAt.getTime() - now.getTime()) / 86_400_000) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <Link href="/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Add a case
        </Link>
      </div>
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
          <nav aria-label="Filter by tag" className="flex flex-wrap items-center gap-2">
            {tagFilter.length > 0 && (
              <>
                <span className="text-sm text-[var(--muted)]">Tags:</span>
                <Link href="/cases" aria-current={activeTag ? undefined : "page"} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${activeTag ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"}`}>
                    All {cases.length}
                  </span>
                </Link>
                {tagFilter.map((tg) => (
                  <Link
                    key={tg.id}
                    href={activeTag === tg.id ? "/cases" : `/cases?tag=${encodeURIComponent(tg.id)}`}
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
          <CaseTable rows={shown} hrefBase="/cases" es={preferEs} />
        </>
      )}
    </>
  );
}
