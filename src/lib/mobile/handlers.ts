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
import { PROCESSING_TIMES_URL, STAGE_COUNT, approvalNextStep, caseStage, formInfo, receivingOffice, recentApprovalAt } from "@/lib/case-insights";
import { recentApprovals } from "@/lib/cases/approvals";
import { caseTagsSelect, createTagService, flatTags, TAG_COLORS, TAG_LIMITS, type TagResult } from "@/lib/cases/tags";

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

export function createMobileApi({ db, cases, now = () => new Date() }: { db: PrismaClient; cases: CaseService; now?: () => Date }) {
  const ent = createEntitlements({ db, now });

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
    // The list leaves out the long USCIS history; the case screen has it.
    const { uscisHistory: _omit, ...listSelect } = caseViewSelect;
    void _omit;
    const rows = await db.trackedCase.findMany({ where: { ownerUserId: userId }, select: { ...listSelect, ...caseTagsSelect }, orderBy: { createdAt: "desc" } });
    const approvals = await recentApprovals(db, rows, now());
    return ok({
      stageCount: STAGE_COUNT,
      cases: rows.map((r) => ({
        ...r,
        tags: flatTags(r.tags),
        category: statusCategory(r.statusTitleEn),
        stage: caseStage(r.statusTitleEn),
        form: formInfo(r.formType),
        recentApprovalAt: approvals.get(r.id) ?? null,
      })),
    });
  }

  async function getCase(userId: string, caseId: string): Promise<ApiResult> {
    const c = await cases.getCase(userId, caseId);
    if (!c) return err(404, "not_found", "Case not found.");
    const consent = c.consents.find((x) => !x.withdrawnAt) ?? null;
    const guide = findStatusGuide(c.statusTitleEn);
    const approvedAt = recentApprovalAt(c.statusTitleEn, c.events, now());
    const history = Array.isArray(c.uscisHistory) ? (c.uscisHistory as { textEn?: string | null }[]) : null;
    return ok({
      case: {
        ...Object.fromEntries(Object.entries(c).filter(([k]) => k !== "consents" && k !== "events" && k !== "uscisHistory" && k !== "tags")),
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
        // Set while CasePingo saw this case become approved recently: the app shows a congratulations card.
        celebration: approvedAt && { approvedAt, nextStep: approvalNextStep(c.formType, c.statusTitleEn) },
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

  // ---- Tags (personal cases) ----
  const TAG_STATUS = { invalid: 400, duplicate: 409, limit: 403, not_found: 404 } as const;
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

  return { me, updateMe, config, guide, listCases, getCase, addCase, refreshCase, renameCase, removeCase, checkInstead, registerDevice, unregisterDevice, listTags, createTag, updateTag, deleteTag, setCaseTags };
}

export type MobileApi = ReturnType<typeof createMobileApi>;
