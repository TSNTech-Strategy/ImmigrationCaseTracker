import Link from "next/link";
import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";
import { getUscisClient } from "@/lib/uscis";

export const metadata: Metadata = { title: "My cases · ImmigrationCaseTracker" };

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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <Link href="/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Add a case
        </Link>
      </div>
      <ModeBanner mode={mode} />
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}

      {cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="font-medium">You aren&apos;t tracking any cases yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add the receipt number from your USCIS notice (for example EAC9999103402) to start.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((c) => {
            const title = (preferEs ? c.statusTitleEs : c.statusTitleEn) ?? c.statusTitleEn;
            return (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{c.nickname ?? c.receiptMasked}</span>
                    <span className="font-mono text-sm text-[var(--muted)]">
                      {c.formType ? `${c.formType} · ` : ""}
                      {c.receiptMasked}
                    </span>
                  </div>
                  <span className="text-lg">{title ?? "Not checked yet"}</span>
                  <span className="text-xs text-[var(--muted)]">
                    Last checked <LocalTime iso={c.lastCheckedAt?.toISOString() ?? null} /> · Last change seen{" "}
                    <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="none yet" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
