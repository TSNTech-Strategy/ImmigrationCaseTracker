import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CaseService, RefreshResult } from "@/lib/cases/service";
import { caseViewSelect } from "@/lib/cases/service";
import { CONSENT_FOOTNOTE, CONSENT_STATEMENT_VERSION, INDIVIDUAL_CONSENT_OPTIONS } from "@/lib/cases/consent";
import { createEntitlements } from "@/lib/billing/entitlements";
import { isExpoPushToken } from "@/lib/push";
import { PLAN_LIMITS, describeCadence } from "@/lib/plans";

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

const deviceBody = z.object({
  token: z.string().refine(isExpoPushToken, "Not an Expo push token."),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(40).optional(),
});

export function createMobileApi({ db, cases, now = () => new Date() }: { db: PrismaClient; cases: CaseService; now?: () => Date }) {
  const ent = createEntitlements({ db, now });

  async function me(userId: string): Promise<ApiResult> {
    const u = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, locale: true, plan: true, mfaEnrolledAt: true, notificationPreference: true },
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
      plan: { id: u.plan, name: PLAN_LIMITS[u.plan].label, maxCases: PLAN_LIMITS[u.plan].maxCases, cadence: describeCadence(u.plan) },
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
    const rows = await db.trackedCase.findMany({ where: { ownerUserId: userId }, select: listSelect, orderBy: { createdAt: "desc" } });
    return ok({ cases: rows });
  }

  async function getCase(userId: string, caseId: string): Promise<ApiResult> {
    const c = await cases.getCase(userId, caseId);
    if (!c) return err(404, "not_found", "Case not found.");
    const consent = c.consents.find((x) => !x.withdrawnAt) ?? null;
    return ok({
      case: {
        ...Object.fromEntries(Object.entries(c).filter(([k]) => k !== "consents" && k !== "events")),
        events: c.events.map((e) => ({
          id: e.id,
          statusTitleEn: e.statusTitleEn,
          statusTitleEs: e.statusTitleEs,
          uscisReportedRaw: e.uscisReportedRaw,
          firstObservedAt: e.firstObservedAt,
        })),
        consent: consent && { basis: consent.basis, capturedAt: consent.capturedAt },
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
    return { status: REFRESH_STATUS[r.status], body: { status: r.status, message: r.message } };
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

  return { me, updateMe, config, listCases, getCase, addCase, refreshCase, removeCase, checkInstead, registerDevice, unregisterDevice };
}

export type MobileApi = ReturnType<typeof createMobileApi>;
