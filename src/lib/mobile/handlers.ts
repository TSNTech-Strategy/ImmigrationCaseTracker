import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CaseService, RefreshResult } from "@/lib/cases/service";
import { caseViewSelect } from "@/lib/cases/service";
import { CONSENT_FOOTNOTE, CONSENT_STATEMENT_VERSION, INDIVIDUAL_CONSENT_OPTIONS } from "@/lib/cases/consent";
import { createEntitlements } from "@/lib/billing/entitlements";
import { isExpoPushToken } from "@/lib/push";
import { PLAN_LIMITS, describeCadence } from "@/lib/plans";
import { statusCategory } from "@/lib/status-category";
import { STATUS_GUIDE, findStatusGuide, guideCategory, guideHeading, guidePath, guideText } from "@/lib/status-guide";
import { PROCESSING_TIMES_URL, STAGE_COUNT, approvalNextStep, caseStage, formInfo, observedApprovalAt, receivingOffice, recentApprovalAt } from "@/lib/case-insights";
import { recentApprovals } from "@/lib/cases/approvals";
import { caseTagsSelect, createTagService, flatTags, TAG_COLORS, TAG_LIMITS, type TagResult } from "@/lib/cases/tags";
import { caseJourney, dayOf, daysBetween } from "@/lib/journeys";
import { createInsightsService, type InsightsService } from "@/lib/insights";
import { COMMON_TIPS, REVIEWED, checklistByKey, checklistForForm, checklistProgress, checklistSummaries } from "@/lib/checklists";
import { createChecklistService } from "@/lib/checklists-service";
import { caseGlance, journeyShare, nextStepFor } from "@/lib/my-cases";
import { COURT_GUIDE, COURT_REVIEWED } from "@/lib/court";

/**
 * The mobile app's API (/api/v1/*), as plain functions so they can be tested
 * against a real database. Route files only authenticate and call these.
 *
 * - Personal cases only (law-firm features stay on the website in v1).
 * - Every case query is scoped to the signed-in user; someone else's case
 *   is indistinguishable from a missing one (404).
 * - Responses never contain ciphertext, digests or full receipt numbers.
 * - No purchasing in the app: it shows the plan, nothing to buy.
 */

export type ApiResult = { status: number; body: unknown };
const ok = (body: unknown, status = 200): ApiResult => ({ status, body });
const err = (status: number, error: string, message: string, field?: string): ApiResult => ({
  status,
  body: { error, message, ...(field ? { field } : {}) },
});

const REFRESH_STATUS: Record<RefreshResult["status"], number> = {
  updated: 200,
  failed: 502,
  cooldown: 429,
  limit: 429,
  budget: 429,
  no_consent: 409,
  paused: 409,
  not_found: 404,
};

const profilePatch = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    locale: z.enum(["en", "es"]).optional(),
    emailOnChange: z.boolean().optional(),
    pushOnChange: z.boolean().optional(),
  })
  .strict();

const addCaseBody = z.object({
  receipt: z.string().trim().min(1).max(40),
  nickname: z.string().trim().max(60).optional().nullable(),
  basis: z.enum(["SELF", "AUTHORIZED_BY_APPLICANT"]),
  consent: z.literal(true),
  statementVersion: z.string().optional(),
});

const renameBody = z.object({ nickname: z.string().trim().max(60).nullable() }).strict();

const deviceBody = z.object({
  token: z.string().refine(isExpoPushToken, "Not an Expo push token."),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(40).optional(),
});

export function createMobileApi({
  db,
  cases,
  now = () => new Date(),
  insights: insightsSvc,
}: {
  db: PrismaClient;
  cases: CaseService;
  now?: () => Date;
  /** Case insights; defaults to simulated-data insights (tests pass their own). */
  insights?: InsightsService;
}) {
  const ent = createEntitlements({ db, now });
  const insightsService = insightsSvc ?? createInsightsService({ db, mode: "mock", now });
  const checklists = createChecklistService({ db });

  const tags = createTagService({ db });

  async function me(userId: string): Promise<ApiResult> {
    const u = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, locale: true, plan: true, mfaEnrolledAt: true, trialEndsAt: true, notificationPreference: true },
    });
    if (!u) return err(404, "not_found", "Account not found.");
    const [caseCount, paused] = await Promise.all([
      db.trackedCase.count({ where: { ownerUserId: userId } }),
      db.trackedCase.count({ where: { ownerUserId: userId, pausedReason: "plan_limit" } }),
    ]);
    return ok({
      id: u.id,
      email: u.email,
      name: u.name,
      locale: u.locale,
      twoFactor: Boolean(u.mfaEnrolledAt),
      plan: {
        id: u.plan,
        name: PLAN_LIMITS[u.plan].label,
        maxCases: PLAN_LIMITS[u.plan].maxCases,
        cadence: describeCadence(u.plan),
        autoChecks: PLAN_LIMITS[u.plan].autoChecks,
        alerts: PLAN_LIMITS[u.plan].alerts,
        manualChecksPerDay: PLAN_LIMITS[u.plan].manualChecksPerDay,
        trialEndsAt: u.trialEndsAt && u.trialEndsAt > now() ? u.trialEndsAt : null,
      },
      cases: { count: caseCount, pausedByPlan: paused },
      alerts: { email: u.notificationPreference?.emailOnChange ?? true, push: u.notificationPreference?.pushOnChange ?? false },
    });
  }

  async function updateMe(userId: string, input: unknown): Promise<ApiResult> {
    const p = profilePatch.safeParse(input);
    if (!p.success) return err(400, "invalid", "Check the values you sent.", String(p.error.issues[0]?.path[0] ?? ""));
    const { name, locale, emailOnChange, pushOnChange } = p.data;
    if (name !== undefined || locale !== undefined) {
      await db.user.update({ where: { id: userId }, data: { ...(name !== undefined ? { name } : {}), ...(locale ? { locale } : {}) } });
    }
    if (emailOnChange !== undefined || pushOnChange !== undefined) {
      const data = { ...(emailOnChange !== undefined ? { emailOnChange } : {}), ...(pushOnChange !== undefined ? { pushOnChange } : {}) };
      await db.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    }
    return me(userId);
  }

  function config(): ApiResult {
    return ok({
      consent: { version: CONSENT_STATEMENT_VERSION, options: INDIVIDUAL_CONSENT_OPTIONS, footnote: CONSENT_FOOTNOTE },
      receiptHint: "3 letters and 10 digits, from the top of your USCIS receipt notice (Form I-797C).",
      uscisCaseStatusUrl: "https://egov.uscis.gov/",
    });
  }

  async function listCases(userId: string): Promise<ApiResult> {
    const rows = await db.trackedCase.findMany({
      where: { ownerUserId: userId },
      select: { ...caseViewSelect, ...caseTagsSelect, events: { select: { statusTitleEn: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    const approvals = await recentApprovals(db, rows, now());
    return ok({
      stageCount: STAGE_COUNT,
      // The list leaves out the long USCIS history and the changes we saw (the case screen has them); they're only used for the line map and days here,
      // with the same inputs as the journey, so My cases and My timeline count the same days.
      cases: rows.map(({ uscisHistory, events, ...r }) => {
        const journey = caseJourney({ ...r, uscisHistory, events }, now());
        const observed = approvals.get(r.id) ?? null;
        return {
          ...r,
          ...journey,
          // My cases at a glance: group (needs attention, in progress, completed), the tiles it counts for, and the next step.
          ...caseGlance(r, journey, { now: now(), observedApprovalAt: observed }),
          tags: flatTags(r.tags),
          category: statusCategory(r.statusTitleEn),
          stage: caseStage(r.statusTitleEn),
          form: formInfo(r.formType),
          recentApprovalAt: observed,
        };
      }),
    });
  }

  async function getCase(userId: string, caseId: string): Promise<ApiResult> {
    const c = await cases.getCase(userId, caseId);
    if (!c) return err(404, "not_found", "Case not found.");
    const consent = c.consents.find((x) => !x.withdrawnAt) ?? null;
    const guide = findStatusGuide(c.statusTitleEn);
    const approvedAt = recentApprovalAt(c.statusTitleEn, c.events, now());
    const history = Array.isArray(c.uscisHistory) ? (c.uscisHistory as { textEn?: string | null }[]) : null;
    const journey = caseJourney(c, now());
    return ok({
      case: {
        ...Object.fromEntries(Object.entries(c).filter(([k]) => k !== "consents" && k !== "events" && k !== "uscisHistory" && k !== "tags")),
        ...journey,
        tags: flatTags(c.tags),
        category: statusCategory(c.statusTitleEn),
        stage: caseStage(c.statusTitleEn),
        uscisHistory: history && history.map((h) => ({ ...h, category: statusCategory(h?.textEn) })),
        events: c.events.map((e) => ({
          id: e.id,
          statusTitleEn: e.statusTitleEn,
          statusTitleEs: e.statusTitleEs,
          uscisReportedRaw: e.uscisReportedRaw,
          firstObservedAt: e.firstObservedAt,
          category: statusCategory(e.statusTitleEn),
        })),
        consent: consent && { basis: consent.basis, capturedAt: consent.capturedAt },
        // Plain-language help, sent from the server so wording can improve without an app release.
        guide: guide && { slug: guide.slug, path: guidePath(guide), en: guideText(guide, "en"), es: guideText(guide, "es") },
        form: formInfo(c.formType),
        office: receivingOffice(c.receiptMasked),
        processingTimesUrl: PROCESSING_TIMES_URL,
        // The document checklist for this case's form, if there is one.
        checklist: (() => {
          const cl = checklistForForm(c.formType);
          return cl ? { key: cl.key, form: cl.form, title: cl.title } : null;
        })(),
        // Set while CasePingo saw this case become approved recently: the app shows a congratulations card.
        celebration: approvedAt && { approvedAt, nextStep: approvalNextStep(c.formType, c.statusTitleEn) },
        nextStep: nextStepFor(c.statusTitleEn, c.formType),
        // Approved cases: the journey in numbers and a message to share (no receipt number, no nickname).
        journeyShare: journeyShare(c, journey, observedApprovalAt(c.statusTitleEn, c.events)),
      },
    });
  }

  async function addCase(userId: string, input: unknown): Promise<ApiResult> {
    const p = addCaseBody.safeParse(input);
    if (!p.success) {
      const field = String(p.error.issues[0]?.path[0] ?? "");
      const message = field === "consent" ? "Please confirm the consent statement." : field === "basis" ? "Choose whose case this is." : "Enter the receipt number from your USCIS notice.";
      return err(400, "invalid", message, field);
    }
    if (p.data.statementVersion && p.data.statementVersion !== CONSENT_STATEMENT_VERSION) {
      return err(409, "consent_outdated", "The consent wording has changed. Please review it again.", "consent");
    }
    const r = await cases.addCase(userId, { receipt: p.data.receipt, nickname: p.data.nickname ?? null, basis: p.data.basis });
    if (!r.ok) {
      if (r.error === "invalid_receipt") return err(400, "invalid_receipt", r.message, "receipt");
      if (r.error === "duplicate") return err(409, "duplicate", r.message, "receipt");
      return err(403, "plan_limit", r.message);
    }
    return ok({ caseId: r.caseId, check: { status: r.check.status, message: r.check.message } }, 201);
  }

  async function refreshCase(userId: string, caseId: string): Promise<ApiResult> {
    const r = await cases.refreshCase(userId, caseId);
    return { status: REFRESH_STATUS[r.status], body: { status: r.status, message: r.message, ...(r.status === "updated" ? { changed: r.changed } : {}) } };
  }

  /** Change (or clear) the case's nickname. Owner only. */
  async function renameCase(userId: string, caseId: string, input: unknown): Promise<ApiResult> {
    const p = renameBody.safeParse(input);
    if (!p.success) return err(400, "invalid", "Use a nickname of up to 60 characters.", "nickname");
    const nickname = p.data.nickname?.trim() || null;
    const r = await db.trackedCase.updateMany({ where: { id: caseId, ownerUserId: userId }, data: { nickname } });
    return r.count === 1 ? ok({ nickname }) : err(404, "not_found", "Case not found.");
  }

  /** The plain-language status guide, both languages (public information). */
  function guide(): ApiResult {
    return ok({
      stageCount: STAGE_COUNT,
      entries: STATUS_GUIDE.map((g) => ({
        slug: g.slug,
        heading: guideHeading(g),
        wordings: [g.title, ...(g.aliases ?? [])],
        category: guideCategory(g),
        stage: caseStage(g.title),
        path: guidePath(g),
        en: guideText(g, "en"),
        es: guideText(g, "es"),
      })),
    });
  }

  async function removeCase(userId: string, caseId: string): Promise<ApiResult> {
    return (await cases.removeCase(userId, caseId)) ? ok({ removed: true }) : err(404, "not_found", "Case not found.");
  }

  async function checkInstead(userId: string, caseId: string): Promise<ApiResult> {
    const r = await ent.chooseCheckedCase(userId, caseId);
    return r.ok ? ok({ ok: true }) : err(404, "not_found", r.error);
  }

  /** Register (or move) a phone's push token and turn push alerts on. */
  async function registerDevice(userId: string, input: unknown): Promise<ApiResult> {
    const p = deviceBody.safeParse(input);
    if (!p.success) return err(400, "invalid", "Invalid push token.", "token");
    const t = now();
    // A token belongs to one phone; if someone else signs in on it, it moves to them.
    await db.pushDevice.upsert({
      where: { token: p.data.token },
      create: { userId, token: p.data.token, platform: p.data.platform, appVersion: p.data.appVersion },
      update: { userId, platform: p.data.platform, appVersion: p.data.appVersion, lastSeenAt: t, disabledAt: null },
    });
    await db.notificationPreference.upsert({ where: { userId }, create: { userId, pushOnChange: true }, update: { pushOnChange: true } });
    return ok({ registered: true }, 201);
  }

  /** Sign-out on a phone: stop pushes to it. Only the owner's own token. */
  async function unregisterDevice(userId: string, input: unknown): Promise<ApiResult> {
    const token = typeof (input as { token?: unknown })?.token === "string" ? (input as { token: string }).token : "";
    await db.pushDevice.updateMany({ where: { userId, token, disabledAt: null }, data: { disabledAt: now() } });
    return ok({ unregistered: true });
  }

  // ---- Updates (the app's notifications tab) and the journey ----

  /** Status changes CasePingo saw across the person's cases, newest first. `first` marks when tracking started. */
  async function updates(userId: string): Promise<ApiResult> {
    const where = { case: { ownerUserId: userId } };
    const [events, firsts] = await Promise.all([
      db.caseStatusEvent.findMany({
        where,
        orderBy: { firstObservedAt: "desc" },
        take: 60,
        select: {
          id: true,
          statusTitleEn: true,
          statusTitleEs: true,
          uscisReportedRaw: true,
          firstObservedAt: true,
          case: { select: { id: true, nickname: true, receiptMasked: true, formType: true } },
        },
      }),
      db.caseStatusEvent.groupBy({ by: ["caseId"], where, _min: { firstObservedAt: true } }),
    ]);
    const firstAt = new Map(firsts.map((f) => [f.caseId, f._min.firstObservedAt?.getTime()]));
    return ok({
      updates: events.map((e) => ({
        id: e.id,
        caseId: e.case.id,
        nickname: e.case.nickname,
        receiptMasked: e.case.receiptMasked,
        form: formInfo(e.case.formType),
        statusTitleEn: e.statusTitleEn,
        statusTitleEs: e.statusTitleEs,
        category: statusCategory(e.statusTitleEn),
        at: e.firstObservedAt,
        reportedDate: dayOf(e.uscisReportedRaw),
        first: firstAt.get(e.case.id) === e.firstObservedAt.getTime(),
      })),
    });
  }

  /** All of the person's cases on one timeline: total days, a bar per case and the milestones with day counts. */
  async function journey(userId: string): Promise<ApiResult> {
    const rows = await db.trackedCase.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        nickname: true,
        receiptMasked: true,
        formType: true,
        statusTitleEn: true,
        statusTitleEs: true,
        uscisHistory: true,
        uscisSubmittedRaw: true,
        uscisModifiedRaw: true,
        lastChangeObservedAt: true,
        events: { select: { statusTitleEn: true, statusTitleEs: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const today = dayOf(now())!;
    const cases = rows.map((r) => {
      const j = caseJourney(r, now());
      const start = j.days.filed;
      const end = j.lineMap.finished ? (j.days.lastUpdate ?? today) : today;
      return { r, j, start, end };
    });
    const dated = cases.filter((x) => x.start);
    if (!dated.length) return ok({ start: null, end: null, totalDays: null, cases: [], milestones: [] });
    const start = dated.map((x) => x.start!).sort()[0];
    const end = dated.map((x) => x.end).sort().at(-1)!;
    type Milestone = { date: string; day: number; caseId: string; form: string | null; titleEn: string | null; titleEs: string | null; category: ReturnType<typeof statusCategory> };
    const milestones: Milestone[] = [];
    const seen = new Set<string>();
    for (const { r } of dated) {
      const form = formInfo(r.formType)?.code ?? null;
      const add = (date: string | null, titleEn: string | null, titleEs: string | null) => {
        if (!date || !titleEn) return;
        const k = `${r.id}|${titleEn.toLowerCase()}|${date}`;
        if (seen.has(k)) return;
        seen.add(k);
        milestones.push({ date, day: daysBetween(start, date), caseId: r.id, form, titleEn, titleEs, category: statusCategory(titleEn) });
      };
      const history = Array.isArray(r.uscisHistory) ? (r.uscisHistory as { date?: { raw?: string; local?: string | null } | null; textEn?: string | null; textEs?: string | null }[]) : [];
      for (const h of history) add(dayOf(h?.date?.local ?? h?.date?.raw ?? null), h?.textEn ?? null, h?.textEs ?? null);
      for (const e of r.events) add(dayOf(e.uscisReportedRaw) ?? dayOf(e.firstObservedAt), e.statusTitleEn, e.statusTitleEs);
    }
    milestones.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
    return ok({
      start,
      end,
      totalDays: daysBetween(start, end),
      cases: dated.map(({ r, j, start: s, end: e }) => ({
        id: r.id,
        nickname: r.nickname,
        receiptMasked: r.receiptMasked,
        form: formInfo(r.formType),
        office: receivingOffice(r.receiptMasked),
        statusTitleEn: r.statusTitleEn,
        statusTitleEs: r.statusTitleEs,
        start: s,
        end: e,
        days: daysBetween(s!, e),
        finished: j.lineMap.finished,
        tone: j.lineMap.tone,
      })),
      milestones,
    });
  }

  /** How the case compares with others like it (anonymous totals; see src/lib/insights.ts). */
  async function caseInsights(userId: string, caseId: string): Promise<ApiResult> {
    const c = await db.trackedCase.findFirst({
      where: { id: caseId, ownerUserId: userId },
      select: {
        receiptMasked: true,
        formType: true,
        statusTitleEn: true,
        statusTitleEs: true,
        uscisHistory: true,
        uscisSubmittedRaw: true,
        uscisModifiedRaw: true,
        lastChangeObservedAt: true,
        events: { select: { statusTitleEn: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } },
      },
    });
    if (!c) return err(404, "not_found", "Case not found.");
    return ok({ insights: await insightsService.forCase(c, userId) });
  }

  // ---- Document checklists ----

  /** Every checklist with this person's progress. */
  /** Immigration court (EOIR): a guide and EOIR's official tools. CasePingo never checks court cases or keeps A-Numbers. */
  function court(): ApiResult {
    return ok({ reviewed: COURT_REVIEWED, guide: COURT_GUIDE });
  }

  async function listChecklists(userId: string): Promise<ApiResult> {
    const ticked = await checklists.all(userId);
    return ok({
      reviewed: REVIEWED,
      tips: COMMON_TIPS,
      checklists: checklistSummaries().map((s) => {
        const p = checklistProgress(checklistByKey(s.key)!, ticked.get(s.key) ?? []);
        return { ...s, done: p.done, requiredDone: p.requiredDone };
      }),
    });
  }

  async function getChecklist(userId: string, key: string): Promise<ApiResult> {
    const c = checklistByKey(key);
    if (!c) return err(404, "not_found", "Checklist not found.");
    return ok({ checklist: c, done: await checklists.done(userId, key), tips: COMMON_TIPS, reviewed: REVIEWED });
  }

  /** {item, done}: tick or untick one item. */
  async function setChecklistItem(userId: string, key: string, body: unknown): Promise<ApiResult> {
    const b = (body ?? {}) as { item?: unknown; done?: unknown };
    if (typeof b.item !== "string" || typeof b.done !== "boolean") return err(400, "invalid", "Send {item, done}.");
    const r = await checklists.set(userId, key, b.item, b.done);
    if (!r.ok) return err(404, "not_found", "Checklist item not found.");
    return ok({ done: r.done });
  }

  // ---- Tags (personal cases) ----
  const TAG_STATUS = { invalid: 400, duplicate: 409, limit: 403, not_found: 404, forbidden: 403 } as const;
  const tagResult = <T>(r: TagResult<T>, body: (v: T) => unknown, status = 200): ApiResult =>
    r.ok ? ok(body(r.value), status) : err(TAG_STATUS[r.error], r.error, r.message, r.error === "invalid" || r.error === "duplicate" ? "name" : undefined);

  /** The person's tags (A to Z) with how many cases each is on, the colors and the limits. */
  async function listTags(userId: string): Promise<ApiResult> {
    return ok({ tags: await tags.list(userId), colors: TAG_COLORS, limits: TAG_LIMITS });
  }
  /** {name, color?}: a new tag (a color is picked when none is sent). */
  async function createTag(userId: string, input: unknown): Promise<ApiResult> {
    const i = (input ?? {}) as { name?: unknown; color?: unknown };
    return tagResult(await tags.create(userId, { name: i.name, color: i.color }), (tag) => ({ tag }), 201);
  }
  /** {name?, color?}: rename or recolor. */
  async function updateTag(userId: string, tagId: string, input: unknown): Promise<ApiResult> {
    const i = (input ?? {}) as { name?: unknown; color?: unknown };
    return tagResult(await tags.update(userId, tagId, { name: i.name, color: i.color }), (tag) => ({ tag }));
  }
  /** Delete a tag: it comes off every case; the cases stay. */
  async function deleteTag(userId: string, tagId: string): Promise<ApiResult> {
    return tagResult(await tags.remove(userId, tagId), () => ({ deleted: true }));
  }
  /** {tagIds: string[]}: exactly these tags on the case. */
  async function setCaseTags(userId: string, caseId: string, input: unknown): Promise<ApiResult> {
    const ids = (input as { tagIds?: unknown } | null)?.tagIds;
    return tagResult(await tags.setCaseTags(userId, caseId, ids), (list) => ({ tags: list }));
  }

  return { me, updateMe, config, guide, listCases, getCase, addCase, refreshCase, renameCase, removeCase, checkInstead, registerDevice, unregisterDevice, listTags, createTag, updateTag, deleteTag, setCaseTags, updates, journey, caseInsights, listChecklists, getChecklist, setChecklistItem, court };
}

export type MobileApi = ReturnType<typeof createMobileApi>;
