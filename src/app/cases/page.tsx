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

export const metadata: Metadata = { title: "My cases · CasePingo" };

const NOTICES: Record<string, string> = {
  "password-updated": "Your password was updated.",
  removed: "The case was removed. We've stopped checking it.",
};

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await requireUser("/cases");
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const cases = await caseService().listCases(user.id);
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
        <CaseTable rows={cases} hrefBase="/cases" es={preferEs} />
      )}
    </>
  );
}
