import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CaseInsights } from "@/components/case-insights";
import { requireUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";
import type { ActivityWindow } from "@/lib/insights";
import { insightsService } from "@/lib/insights-service";

export const metadata: Metadata = { title: "Case insights · CasePingo" };

const windowOf = (v: unknown): ActivityWindow => (v === "7d" || v === "12m" ? v : "30d");

export default async function CaseInsightsPage({ params, searchParams }: PageProps<"/cases/[id]/insights">) {
  const { id } = await params;
  const user = await requireUser(`/cases/${id}/insights`);
  const c = await caseService().getCase(user.id, id);
  if (!c) notFound(); // also for other people's cases
  const window = windowOf((await searchParams).window);
  const data = await insightsService().forCase(c, user.id);
  const es = user.locale === "es";
  return (
    <>
      <Link href={`/cases/${c.id}`} className="text-sm underline underline-offset-2">
        ← {c.nickname ?? c.receiptMasked}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{es ? "Cómo va este caso comparado con otros" : "How this case compares"}</h1>
        <p className="font-mono text-sm text-[var(--muted)]">{[c.formType, c.receiptMasked].filter(Boolean).join(" · ")}</p>
      </div>
      <CaseInsights data={data} es={es} window={window} windowHref={(w) => `/cases/${c.id}/insights?window=${w}#ins-activity`} />
    </>
  );
}
