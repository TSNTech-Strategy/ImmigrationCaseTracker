import type { PrismaClient } from "@prisma/client";
import { recentApprovalAt } from "@/lib/case-insights";
import { statusCategory } from "@/lib/status-category";

/**
 * Cases that CasePingo saw become approved recently (case id → when we saw it).
 * Only approved cases are looked up, so this is one small query.
 */
export async function recentApprovals(
  db: PrismaClient,
  cases: { id: string; statusTitleEn: string | null }[],
  now: Date = new Date(),
): Promise<Map<string, Date>> {
  const approved = cases.filter((c) => statusCategory(c.statusTitleEn) === "done");
  const out = new Map<string, Date>();
  if (approved.length === 0) return out;
  const events = await db.caseStatusEvent.findMany({
    where: { caseId: { in: approved.map((c) => c.id) } },
    select: { caseId: true, statusTitleEn: true, firstObservedAt: true },
  });
  for (const c of approved) {
    const at = recentApprovalAt(
      c.statusTitleEn,
      events.filter((e) => e.caseId === c.id),
      now,
    );
    if (at) out.set(c.id, at);
  }
  return out;
}
