import type { PrismaClient } from "@prisma/client";
import { PROCESSING_TIMES_URL, formInfo, receivingOffice } from "./case-insights";
import { caseJourney, dayOf, daysBetween, phaseOf, type CaseForLineMap, type LineMap } from "./journeys";
import { statusCategory } from "./status-category";
import { findStatusGuide, guideText } from "./status-guide";

/**
 * Case insights: how a case compares with others like it, from cases people
 * track in CasePingo, combined anonymously. Rules:
 * - Personal cases only (law-firm cases are never counted), each receipt once
 *   however many people track it, and only statuses that came from the same
 *   USCIS connection the site runs on (simulated or sandbox data never mixes
 *   with real data).
 * - A number appears only when at least MIN_GROUP different cases are behind
 *   it; smaller groups show "not enough cases yet". Nothing here carries a
 *   receipt number, a name or a nickname.
 * - Comparisons ("cases filed near yours", "what usually comes next") leave
 *   out the viewer's own cases.
 * Pure functions: the service at the bottom loads the cases and caches them.
 */

type Bilingual = { en: string; es: string };
export type UscisMode = "mock" | "sandbox" | "production";

/** A number is shown only when at least this many different cases are behind it. */
export const MIN_GROUP = 10;
/** "Cases filed near yours": filed within this many days either side. */
export const SIMILAR_WINDOW_DAYS = 30;
/** Office times use approvals from this many recent months, so they reflect current speed. */
const OFFICE_MONTHS = 24;
/** Activity counts this small fold into "Other updates", so a lone case never stands out. */
const SMALL_CELL = 3;

/** A status in a case's history, as the statistics see it. */
type Point = { key: string; titleEn: string; titleEs: string | null; date: string };

/** One case as the statistics see it: no receipt number, no names, no nickname. */
export type PoolCase = {
  /** Owner's user id, only to leave the viewer's own cases out of comparisons (null for a firm viewer's case). */
  owner: string | null;
  form: string;
  office: string | null;
  filed: string | null;
  lineMap: LineMap;
  /** USCIS's history plus the current status, oldest first, without repeats; dated points only. */
  seq: Point[];
  approvedOn: string | null;
  hadRfe: boolean;
};

export type ActivityKind = "card" | "approved" | "processing" | "interview" | "evidence" | "denied" | "other";
export const ACTIVITY_LABEL: Record<ActivityKind, Bilingual> = {
  card: { en: "Card or document", es: "Tarjeta o documento" },
  approved: { en: "Approval", es: "Aprobación" },
  processing: { en: "Processing", es: "En proceso" },
  interview: { en: "Interview", es: "Entrevista" },
  evidence: { en: "Evidence request", es: "Solicitud de evidencia" },
  denied: { en: "Denied or rejected", es: "Negado o rechazado" },
  other: { en: "Others", es: "Otros" },
};
/** Fixed order of the kinds (and their colour slots), so a kind keeps its colour whatever its rank. */
export const ACTIVITY_ORDER: ActivityKind[] = ["processing", "evidence", "interview", "approved", "card", "denied", "other"];

const RFE = /request for (additional |initial )?evidence|\brfe\b/i;
const isRfe = (titleEn: string) => RFE.test(titleEn) && !/response to/i.test(titleEn);

/** Which kind of update a USCIS status is, for the activity breakdown. */
export function kindOf(titleEn: string): ActivityKind {
  const slug = findStatusGuide(titleEn)?.slug;
  if (slug === "mail-was-returned-to-uscis") return "other";
  if (isRfe(titleEn)) return "evidence";
  const category = statusCategory(titleEn);
  switch (phaseOf(titleEn)) {
    case "received":
    case "biometrics":
    case "review":
      return "processing";
    case "interview":
      return "interview";
    case "decision":
      return category === "done" ? "approved" : category === "stop" ? "denied" : "other";
    case "produce":
    case "mailed":
    case "delivered":
      return "card";
    case "oath":
      return "approved";
    default:
      return category === "done" ? "approved" : category === "stop" ? "denied" : "other";
  }
}

/** A stable key for a status: the status library's entry, or the wording itself. */
const statusKey = (titleEn: string) => findStatusGuide(titleEn)?.slug ?? titleEn.trim().toLowerCase();

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

type StoredHistory = { date?: { raw?: string | null; local?: string | null } | null; textEn?: string | null; textEs?: string | null };

/** The fields a case needs for insights (the case pages and the API already load them). */
export type CaseForInsights = CaseForLineMap & { receiptMasked: string; statusTitleEs?: string | null };

/** One stored case → what the statistics use. Null when it has no status or no known form. */
export function toPoolCase(c: CaseForInsights & { ownerUserId?: string | null }, now: Date): PoolCase | null {
  const form = formInfo(c.formType)?.code;
  if (!form || !c.statusTitleEn) return null;
  const { lineMap, days } = caseJourney(c, now);
  const history = Array.isArray(c.uscisHistory) ? (c.uscisHistory as StoredHistory[]) : [];
  const points: Point[] = [];
  const add = (titleEn: string | null | undefined, titleEs: string | null | undefined, date: string | null) => {
    if (titleEn && date) points.push({ key: statusKey(titleEn), titleEn, titleEs: titleEs ?? null, date });
  };
  for (const h of history) add(h?.textEn, h?.textEs, dayOf(h?.date?.local ?? h?.date?.raw ?? null));
  for (const e of c.events ?? []) add(e.statusTitleEn, null, dayOf(e.uscisReportedRaw) ?? dayOf(e.firstObservedAt));
  add(c.statusTitleEn, c.statusTitleEs, days.lastUpdate);
  // Oldest first (stable for same-day entries), then drop repeats of the same status.
  const sorted = points.map((p, i) => ({ p, i })).sort((a, b) => (a.p.date === b.p.date ? a.i - b.i : a.p.date < b.p.date ? -1 : 1));
  const seq: Point[] = [];
  for (const { p } of sorted) if (seq.at(-1)?.key !== p.key) seq.push(p);
  return {
    owner: c.ownerUserId ?? null,
    form,
    office: receivingOffice(c.receiptMasked)?.code ?? null,
    filed: days.filed,
    lineMap,
    seq,
    approvedOn: seq.find((p) => statusCategory(p.titleEn) === "done")?.date ?? null,
    hadRfe: seq.some((p) => isRfe(p.titleEn)),
  };
}

/** Today, this month or this year (by USCIS's dates). */
export type ActivityWindow = "day" | "month" | "year";
const windowStart = (w: ActivityWindow, today: string) => (w === "day" ? today : w === "month" ? `${today.slice(0, 7)}-01` : `${today.slice(0, 4)}-01-01`);
/** Days in a month ("YYYY-MM"). */
const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const cumulative = (xs: number[]) => xs.reduce<number[]>((acc, x) => [...acc, (acc.at(-1) ?? 0) + x], []);
const share1 = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export type Insights = {
  form: { code: string; name: Bilingual | null } | null;
  mode: UscisMode;
  minGroup: number;
  similarWindowDays: number;
  /** Cases behind this form's numbers; null until there are at least minGroup. */
  poolSize: number | null;
  yourCase: {
    filed: string | null;
    /** Days from filing to the last update (finished) or to today. */
    days: number | null;
    finished: boolean;
    /** Days since USCIS's last update. */
    daysAtStatus: number | null;
    /** USCIS's last update ("YYYY-MM-DD"): the finish date once the case is finished. */
    lastUpdate: string | null;
    office: { code: string; name: Bilingual | null } | null;
    status: Bilingual | null;
  };
  /** What the status library says usually happens next (always there when the status is in the library). */
  guideNext: Bilingual | null;
  /** The latest USCIS date among the cases behind the numbers ("YYYY-MM-DD"). */
  dataAsOf: string | null;
  /** Approvals so far this month against last month, added up day by day. */
  monthly: { month: string; lastMonth: string; today: number; daysInMonth: number; thisMonth: number[]; last: number[]; thisTotal: number; lastTotal: number } | null;
  /** The next status seen after this one in other cases (share of cases, median and average days). */
  next: { cases: number; options: { title: Bilingual; share: number; cases: number; medianDays: number | null; avgDays: number | null }[] } | null;
  /** Cases of the same form filed within similarWindowDays of this one; rank 1 is the furthest along. */
  similar: { cases: number; steps: { key: string; label: Bilingual; cases: number; you: boolean }[]; aheadOf: number; approvedShare: number; rank: number; of: number } | null;
  /** Median days from filing to approval, by receiving office (recent approvals). */
  offices: { overallMedianDays: number | null; cases: number; rows: { code: string; name: Bilingual | null; medianDays: number; cases: number; yours: boolean }[] } | null;
  rates: { approval: { rate: number; decided: number } | null; rfe: { rate: number; cases: number } | null } | null;
  /** Updates by kind today, this month and this year; share has one decimal. */
  activity: { window: ActivityWindow; from: string; cases: number | null; kinds: { key: ActivityKind; label: Bilingual; cases: number; share: number }[] }[];
  /** Approvals, evidence requests and denials per month, last 12 months, oldest first. */
  trend: { months: { month: string; approved: number; evidence: number; denied: number }[]; total: number } | null;
  processingTimesUrl: string;
};

/** Insights for one case against the pool of cases with the same form. */
export function buildInsights(viewer: CaseForInsights & { ownerUserId?: string | null }, pool: PoolCase[], opts: { now: Date; mode: UscisMode }): Insights {
  const today = dayOf(opts.now)!;
  const form = formInfo(viewer.formType);
  const office = receivingOffice(viewer.receiptMasked);
  const { lineMap, days } = caseJourney(viewer, opts.now);
  const g = findStatusGuide(viewer.statusTitleEn);
  const me = toPoolCase(viewer, opts.now);
  const status = viewer.statusTitleEn ? { en: viewer.statusTitleEn, es: viewer.statusTitleEs ?? viewer.statusTitleEn } : null;
  const base: Insights = {
    form,
    mode: opts.mode,
    minGroup: MIN_GROUP,
    similarWindowDays: SIMILAR_WINDOW_DAYS,
    poolSize: null,
    dataAsOf: null,
    monthly: null,
    yourCase: { filed: days.filed, days: days.total, finished: lineMap.finished, daysAtStatus: days.sinceUpdate, lastUpdate: days.lastUpdate, office, status },
    guideNext: g ? { en: guideText(g, "en").next, es: guideText(g, "es").next } : null,
    next: null,
    similar: null,
    offices: null,
    rates: null,
    activity: (["day", "month", "year"] as const).map((w) => ({ window: w, from: windowStart(w, today), cases: null, kinds: [] })),
    trend: null,
    processingTimesUrl: PROCESSING_TIMES_URL,
  };
  if (!me || !form) return base;
  const cases = pool.filter((c) => c.form === me.form);
  const others = viewer.ownerUserId ? cases.filter((c) => c.owner !== viewer.ownerUserId) : cases;

  // What usually comes next: the status each other case got right after this one.
  const from = statusKey(viewer.statusTitleEn!);
  const nextBy = new Map<string, { title: Bilingual; cases: number; days: number[] }>();
  let moved = 0;
  for (const c of others) {
    const i = c.seq.findIndex((p) => p.key === from);
    if (i < 0 || i === c.seq.length - 1) continue;
    const n = c.seq[i + 1];
    moved++;
    const e = nextBy.get(n.key) ?? { title: { en: n.titleEn, es: n.titleEs ?? n.titleEn }, cases: 0, days: [] };
    e.cases++;
    e.days.push(daysBetween(c.seq[i].date, n.date));
    nextBy.set(n.key, e);
  }
  const next =
    moved >= MIN_GROUP
      ? {
          cases: moved,
          options: [...nextBy.values()]
            .sort((a, b) => b.cases - a.cases)
            .slice(0, 3)
            .map((e) => ({
              title: e.title,
              share: pct(e.cases, moved),
              cases: e.cases,
              medianDays: median(e.days),
              avgDays: e.days.length ? Math.round(e.days.reduce((a, b) => a + b, 0) / e.days.length) : null,
            })),
        }
      : null;

  // Cases filed near yours: where they are on the same line map.
  let similar: Insights["similar"] = null;
  if (me.filed && lineMap.current >= 0) {
    const near = others.filter((c) => c.filed && Math.abs(daysBetween(me.filed!, c.filed)) <= SIMILAR_WINDOW_DAYS && c.lineMap.current >= 0);
    if (near.length >= MIN_GROUP) {
      similar = {
        cases: near.length,
        steps: lineMap.steps.map((s, i) => ({ key: s.key, label: s.label, cases: near.filter((c) => c.lineMap.current === i).length, you: i === lineMap.current })),
        aheadOf: pct(near.filter((c) => c.lineMap.current < lineMap.current).length, near.length),
        approvedShare: pct(near.filter((c) => c.lineMap.outcome === "approved").length, near.length),
        rank: near.filter((c) => c.lineMap.current > lineMap.current).length + 1,
        of: near.length + 1,
      };
    }
  }

  // Time to approval by office, from recent approvals.
  const since = new Date(opts.now);
  since.setUTCMonth(since.getUTCMonth() - OFFICE_MONTHS);
  const sinceDay = dayOf(since)!;
  const approved = cases.filter((c) => c.filed && c.approvedOn && c.approvedOn >= sinceDay && daysBetween(c.filed, c.approvedOn) >= 0);
  const byOffice = new Map<string, number[]>();
  for (const c of approved) if (c.office) byOffice.set(c.office, [...(byOffice.get(c.office) ?? []), daysBetween(c.filed!, c.approvedOn!)]);
  const officeRows = [...byOffice.entries()]
    .filter(([, xs]) => xs.length >= MIN_GROUP)
    .map(([code, xs]) => ({ code, name: receivingOffice(code)?.name ?? null, medianDays: median(xs)!, cases: xs.length, yours: code === office?.code }))
    .sort((a, b) => b.medianDays - a.medianDays);
  const overall = approved.length >= MIN_GROUP ? median(approved.map((c) => daysBetween(c.filed!, c.approvedOn!))) : null;
  const offices = officeRows.length || overall !== null ? { overallMedianDays: overall, cases: approved.length >= MIN_GROUP ? approved.length : 0, rows: officeRows } : null;

  // Approval and evidence-request rates.
  const decided = cases.filter((c) => c.lineMap.outcome !== null);
  const approval = decided.length >= MIN_GROUP ? { rate: pct(decided.filter((c) => c.lineMap.outcome === "approved").length, decided.length), decided: decided.length } : null;
  const rfe = cases.length >= MIN_GROUP ? { rate: pct(cases.filter((c) => c.hadRfe).length, cases.length), cases: cases.length } : null;

  // Activity: which kinds of updates cases got today, this month and this year (by USCIS's date).
  const activity = (["day", "month", "year"] as const).map((w) => {
    const from = windowStart(w, today);
    const counts = new Map<ActivityKind, number>();
    let active = 0;
    for (const c of cases) {
      const kinds = new Set(c.seq.filter((p) => p.date >= from && p.date <= today).map((p) => kindOf(p.titleEn)));
      if (!kinds.size) continue;
      active++;
      for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (active < MIN_GROUP) return { window: w, from, cases: null, kinds: [] };
    // Small cells join "Others" so a single case never stands out.
    for (const [k, n] of [...counts]) {
      if (k !== "other" && n < SMALL_CELL) {
        counts.delete(k);
        counts.set("other", (counts.get("other") ?? 0) + n);
      }
    }
    const sum = [...counts.values()].reduce((a, b) => a + b, 0);
    const kinds = [...counts.entries()]
      .map(([key, n]) => ({ key, label: ACTIVITY_LABEL[key], cases: n, share: share1(n, sum) }))
      .sort((a, b) => (a.key === "other" ? 1 : b.key === "other" ? -1 : b.cases - a.cases));
    return { window: w, from, cases: active, kinds };
  });

  // Approvals this month against last month, day by day.
  const ym = today.slice(0, 7);
  const prevDate = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 2, 1));
  const lastYm = prevDate.toISOString().slice(0, 7);
  const dayNo = Number(today.slice(8, 10));
  const thisDaily = Array.from({ length: dayNo }, () => 0);
  const lastDaily = Array.from({ length: daysInMonth(lastYm) }, () => 0);
  for (const c of cases) {
    if (!c.approvedOn) continue;
    const d = Number(c.approvedOn.slice(8, 10));
    if (c.approvedOn.startsWith(ym) && d <= dayNo) thisDaily[d - 1]++;
    else if (c.approvedOn.startsWith(lastYm)) lastDaily[d - 1]++;
  }
  const thisTotal = thisDaily.reduce((a, b) => a + b, 0);
  const lastTotal = lastDaily.reduce((a, b) => a + b, 0);
  const monthly =
    thisTotal + lastTotal >= MIN_GROUP
      ? { month: ym, lastMonth: lastYm, today: dayNo, daysInMonth: daysInMonth(ym), thisMonth: cumulative(thisDaily), last: cumulative(lastDaily), thisTotal, lastTotal }
      : null;

  // Approvals, evidence requests and denials per month, last 12 months (each case once per month and kind).
  const months: { month: string; approved: number; evidence: number; denied: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(opts.now.getUTCFullYear(), opts.now.getUTCMonth() - i, 1));
    months.push({ month: d.toISOString().slice(0, 7), approved: 0, evidence: 0, denied: 0 });
  }
  for (const c of cases) {
    const seen = new Set<string>();
    for (const p of c.seq) {
      const k = kindOf(p.titleEn);
      const key = k === "approved" ? "approved" : k === "evidence" ? "evidence" : k === "denied" ? "denied" : null;
      const row = key && months.find((x) => x.month === p.date.slice(0, 7));
      if (!key || !row || seen.has(`${row.month}|${key}`)) continue;
      seen.add(`${row.month}|${key}`);
      row[key]++;
    }
  }
  const total = months.reduce((a, b) => a + b.approved + b.evidence + b.denied, 0);
  const dataAsOf = cases.length >= MIN_GROUP ? (cases.flatMap((c) => c.seq.map((p) => p.date)).filter((d) => d <= today).sort().at(-1) ?? null) : null;

  return {
    ...base,
    poolSize: cases.length >= MIN_GROUP ? cases.length : null,
    dataAsOf,
    monthly,
    next,
    similar,
    offices,
    rates: approval || rfe ? { approval, rfe } : null,
    activity,
    trend: total >= MIN_GROUP ? { months, total } : null,
  };
}

// ---- Loading the pool --------------------------------------------------------------------

/**
 * Loads and caches the pool per form (10 minutes by default). Each receipt counts once:
 * when several people track the same case, the most recently checked copy is used.
 */
export function createInsightsService({ db, mode, now = () => new Date(), ttlMs = 10 * 60_000 }: { db: Pick<PrismaClient, "trackedCase">; mode: UscisMode; now?: () => Date; ttlMs?: number }) {
  const cache = new Map<string, { at: number; pool: PoolCase[] }>();

  async function poolFor(form: string): Promise<PoolCase[]> {
    const hit = cache.get(form);
    const t = now().getTime();
    if (hit && t - hit.at < ttlMs) return hit.pool;
    const variants = [...new Set([form, form.replace("-", "")])];
    const rows = await db.trackedCase.findMany({
      where: {
        ownerUserId: { not: null },
        statusSource: mode,
        statusTitleEn: { not: null },
        OR: variants.map((v) => ({ formType: { equals: v, mode: "insensitive" as const } })),
      },
      select: {
        ownerUserId: true,
        receiptDigest: true,
        receiptMasked: true,
        formType: true,
        statusTitleEn: true,
        statusTitleEs: true,
        uscisHistory: true,
        uscisSubmittedRaw: true,
        uscisModifiedRaw: true,
        lastChangeObservedAt: true,
        lastCheckedAt: true,
      },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const prev = latest.get(r.receiptDigest);
      if (!prev || (r.lastCheckedAt?.getTime() ?? 0) > (prev.lastCheckedAt?.getTime() ?? 0)) latest.set(r.receiptDigest, r);
    }
    const pool = [...latest.values()].map((r) => toPoolCase(r, now())).filter((c): c is PoolCase => c !== null && c.form === form);
    cache.set(form, { at: t, pool });
    return pool;
  }

  /** Insights for a case the caller may see (their own, or their firm's). viewerUserId leaves their own cases out of comparisons. */
  async function forCase(c: CaseForInsights, viewerUserId: string | null): Promise<Insights> {
    const form = formInfo(c.formType)?.code;
    const pool = form && c.statusTitleEn ? await poolFor(form) : [];
    return buildInsights({ ...c, ownerUserId: viewerUserId }, pool, { now: now(), mode });
  }

  return { forCase, poolFor };
}
export type InsightsService = ReturnType<typeof createInsightsService>;
