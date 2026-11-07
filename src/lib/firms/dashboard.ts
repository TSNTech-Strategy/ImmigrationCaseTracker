import type { PrismaClient, Prisma } from "@prisma/client";
import { caseViewSelect } from "@/lib/cases/service";
import { caseJourney } from "@/lib/journeys";
import { formInfo } from "@/lib/case-insights";
import { statusCategory, type StatusCategory } from "@/lib/status-category";
import { findFirmContext } from "./service";
import { CATEGORY_LABEL, caseCategory, countryName, type CaseCategory } from "./profile";
import { daysUntil, easternDay } from "./alerts";

/**
 * The firm dashboard: numbers from the firm's own cases only (never USCIS processing times).
 * Filters: who the cases are assigned to, and when they were added.
 */

export type DashboardFilters = { assignee?: string; from?: string; to?: string };
export type Bar = { key: string; label: string; value: number; href?: string };

const DAY = 86_400_000;
const STATUS_ORDER: StatusCategory[] = ["action", "progress", "done", "stop", "none"];
const STATUS_LABEL: Record<StatusCategory, string> = { action: "Action may be needed", progress: "In progress", done: "Approved", stop: "Decision (denied, closed, withdrawn)", none: "Not checked yet" };
export const WAIT_BUCKETS = [
  { key: "0-30", label: "Up to 30 days", min: 0, max: 30 },
  { key: "31-90", label: "31–90 days", min: 31, max: 90 },
  { key: "91-180", label: "91–180 days", min: 91, max: 180 },
  { key: "181-365", label: "6–12 months", min: 181, max: 365 },
  { key: "366+", label: "Over a year", min: 366, max: Infinity },
] as const;

const isDay = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()));

/** Top n by value, the rest folded into "Other". */
function top(map: Map<string, { label: string; value: number; href?: string }>, n: number, otherLabel = "Other"): Bar[] {
  const rows = [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (rows.length <= n) return rows;
  const rest = rows.slice(n - 1).reduce((s, r) => s + r.value, 0);
  return [...rows.slice(0, n - 1), { key: "_other", label: otherLabel, value: rest }];
}
const bump = (map: Map<string, { label: string; value: number; href?: string }>, key: string, label: string, href?: string) => {
  const cur = map.get(key);
  if (cur) cur.value++;
  else map.set(key, { label, value: 1, href });
};

export function createFirmDashboardService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function getDashboard(userId: string, filters: DashboardFilters = {}) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const t = now();
    const firmId = ctx.firm.id;
    const tz = ctx.firm.timeZone;
    const today = easternDay(t, tz);
    const assigneeId = filters.assignee === "me" ? userId : filters.assignee === "none" ? null : filters.assignee;
    const from = isDay(filters.from) ? filters.from : undefined;
    const to = isDay(filters.to) ? filters.to : undefined;

    const where: Prisma.TrackedCaseWhereInput = {
      firmId,
      ...(filters.assignee ? { assigneeId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY) } : {}) } } : {}),
    };
    const caseScope: Prisma.TrackedCaseWhereInput = filters.assignee ? { assigneeId } : {};

    const [cases, members, openItems, deadlines, recent] = await Promise.all([
      db.trackedCase.findMany({
        where,
        select: {
          ...caseViewSelect,
          assigneeId: true,
          clientId: true,
          client: { select: { countryOfBirth: true } },
          consents: { where: { withdrawnAt: null }, select: { id: true }, take: 1 },
        },
        take: 5000,
      }),
      db.firmMembership.findMany({ where: { firmId, revokedAt: null }, select: { userId: true, user: { select: { name: true, email: true } } } }),
      db.firmUpdate.count({ where: { firmId, OR: [{ state: "OPEN" }, { state: "SNOOZED", snoozedUntil: { lte: t } }], ...(filters.assignee ? { case: caseScope } : {}) } }),
      db.caseDeadline.findMany({
        where: { firmId, doneAt: null, dueOn: { lte: new Date(new Date(`${today}T00:00:00Z`).getTime() + 14 * DAY) }, ...(filters.assignee ? { case: caseScope } : {}) },
        select: { id: true, kind: true, dueOn: true, note: true, case: { select: { id: true, receiptMasked: true, nickname: true, client: { select: { displayName: true } } } } },
        orderBy: { dueOn: "asc" },
        take: 8,
      }),
      db.firmUpdate.findMany({
        where: { firmId, kind: "STATUS_CHANGE", ...(filters.assignee ? { case: caseScope } : {}) },
        select: { id: true, createdAt: true, event: { select: { statusTitleEn: true } }, case: { select: { id: true, receiptMasked: true, nickname: true, formType: true, client: { select: { displayName: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    const names = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));
    const byForm = new Map<string, { label: string; value: number; href?: string }>();
    const byCategory = new Map<string, { label: string; value: number; href?: string }>();
    const byStatus = new Map<string, { label: string; value: number; href?: string }>();
    const byAssignee = new Map<string, { label: string; value: number; href?: string }>();
    const byCountry = new Map<string, { label: string; value: number; href?: string }>();
    const waiting = new Map<string, { label: string; value: number; href?: string }>(WAIT_BUCKETS.map((b) => [b.key, { label: b.label, value: 0 }]));
    const clientsSeen = new Set<string>();
    const stuckDays = ctx.firm.stuckAfterDays > 0 ? ctx.firm.stuckAfterDays : 90;
    let changedWeek = 0;
    let stuck = 0;
    let noConsent = 0;

    for (const c of cases) {
      const code = formInfo(c.formType)?.code;
      if (code) bump(byForm, code, code, `/firm/cases?q=${encodeURIComponent(code)}`);
      else bump(byForm, "_none", "Form not known yet");
      const cat: CaseCategory = caseCategory(c.formType);
      bump(byCategory, cat, CATEGORY_LABEL(cat), `/firm/cases?category=${cat}`);
      const st = statusCategory(c.statusTitleEn);
      bump(byStatus, st, STATUS_LABEL[st]);
      if (c.assigneeId) bump(byAssignee, c.assigneeId, names.get(c.assigneeId) ?? "Former member", `/firm/cases?assignee=${c.assigneeId}`);
      else bump(byAssignee, "_none", "Unassigned", "/firm/cases?assignee=none");
      if (c.clientId && !clientsSeen.has(c.clientId)) {
        clientsSeen.add(c.clientId);
        const cc = c.client?.countryOfBirth;
        if (cc) bump(byCountry, cc, countryName(cc) ?? cc, `/firm/clients?country=${cc}`);
        else bump(byCountry, "_none", "Not recorded");
      }
      if (c.lastChangeObservedAt && t.getTime() - c.lastChangeObservedAt.getTime() <= 7 * DAY) changedWeek++;
      if (c.consents.length === 0) noConsent++;
      const j = caseJourney(c, t);
      const since = j.days.sinceUpdate;
      if (!j.lineMap.finished && since !== null && c.statusTitleEn) {
        const b = WAIT_BUCKETS.find((x) => since >= x.min && since <= x.max)!;
        waiting.get(b.key)!.value++;
        if (since >= stuckDays) stuck++;
      }
    }
    const statusBars: Bar[] = STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({ key: s, label: STATUS_LABEL[s], value: byStatus.get(s)!.value }));
    const dueSoon = await db.caseDeadline.count({
      where: { firmId, doneAt: null, dueOn: { lte: new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * DAY) }, ...(filters.assignee ? { case: caseScope } : {}) },
    });

    return {
      ctx,
      filters: { assignee: filters.assignee ?? "", from: from ?? "", to: to ?? "" },
      members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
      kpis: { cases: cases.length, changedWeek, openItems, dueSoon, stuck, stuckDays, noConsent },
      byForm: top(byForm, 8),
      byCategory: top(byCategory, 8),
      byStatus: statusBars,
      byAssignee: top(byAssignee, 8),
      byCountry: top(byCountry, 8),
      waiting: [...waiting.entries()].map(([key, v]) => ({ key, ...v })),
      deadlines: deadlines.map((d) => ({ ...d, daysLeft: daysUntil(d.dueOn, today) })),
      recent: recent.flatMap((r) => (r.case ? [{ ...r, case: r.case }] : [])),
    };
  }

  return { getDashboard };
}

export type FirmDashboard = NonNullable<Awaited<ReturnType<ReturnType<typeof createFirmDashboardService>["getDashboard"]>>>;
