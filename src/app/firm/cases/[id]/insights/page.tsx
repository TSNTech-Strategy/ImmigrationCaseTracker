import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CaseInsights } from "@/components/case-insights";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import type { ActivityWindow } from "@/lib/insights";
import { insightsService } from "@/lib/insights-service";

export const metadata: Metadata = { title: "Case insights · CasePingo" };

const windowOf = (v: unknown): ActivityWindow | null => (v === "day" || v === "month" || v === "year" ? v : null);
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/** Insights for a firm case: compared with personal cases tracked in CasePingo (firm cases are never part of the totals). */
export default async function FirmCaseInsightsPage({ params, searchParams }: PageProps<"/firm/cases/[id]/insights">) {
  const { id } = await params;
  const user = await requireUser(`/firm/cases/${id}/insights`);
  const found = await firmCaseService().getCase(user.id, id);
  if (!found) notFound(); // also for other firms' cases
  const c = found.case;
  const sp = await searchParams;
  const win = windowOf(sp.window);
  const kind = one(sp.kind);
  const officeCode = one(sp.office)?.toUpperCase() ?? null;
  const base = `/firm/cases/${c.id}/insights`;
  // Links keep the other choices: a new window resets the highlighted category.
  const href = (p: { window?: ActivityWindow; kind?: string; office?: string }, anchor: string) => {
    const q = new URLSearchParams();
    const w = p.window ?? win;
    if (w) q.set("window", w);
    const k = p.window ? p.kind : (p.kind ?? kind);
    if (k) q.set("kind", k);
    const o = p.office ?? officeCode;
    if (o) q.set("office", o);
    return `${base}?${q.toString()}#${anchor}`;
  };
  const data = await insightsService().forCase(c, null);
  const es = user.locale === "es";
  return (
    <>
      <Link href={`/firm/cases/${c.id}`} className="text-sm underline underline-offset-2">
        ← {c.nickname ?? c.receiptMasked}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{es ? "Cómo va este caso comparado con otros" : "How this case compares"}</h1>
        <p className="font-mono text-sm text-[var(--muted)]">{[c.formType, c.receiptMasked].filter(Boolean).join(" · ")}</p>
      </div>
      <CaseInsights data={data} es={es} window={win} kind={kind} office={officeCode} href={href} />
    </>
  );
}
