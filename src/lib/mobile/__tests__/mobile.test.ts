/** Mobile API handlers and push alerts against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { CONSENT_STATEMENT_VERSION } from "@/lib/cases/consent";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import type { PushDriver, PushMessage, PushResult } from "@/lib/push";
import { notifyStatusChange } from "@/lib/jobs/notifications";
import { createMobileApi } from "../handlers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("mobile API", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-08-01T12:00:00Z");
  const now = () => clock;
  let title = "Case Was Received";
  const uscis: UscisPort = {
    mode: "mock",
    getCaseStatus: async (r) =>
      title === "mock" ? mockFetchCaseStatus(r) : { httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: r, current_case_status_text_en: title } }, r) },
  };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const api = createMobileApi({ db, cases, now });
  const users: string[] = [];
  const mkUser = async (plan: "FREE" | "PREMIUM" = "PREMIUM") => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `m-${id}@test.dev`, name: "Mobile", plan, locale: "es" } });
    users.push(id);
    return id;
  };
  const body = (r: { body: unknown }) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const add = (u: string, receipt: string, extra: object = {}) =>
    api.addCase(u, { receipt, basis: "SELF", consent: true, statementVersion: CONSENT_STATEMENT_VERSION, ...extra });

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 2).toString("base64");
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("adds, lists, shows, refreshes and removes personal cases, never exposing receipts or ciphertext", async () => {
    const u = await mkUser();
    expect(await api.addCase(u, { receipt: "EAC9999103402", basis: "SELF" })).toMatchObject({ status: 400, body: { field: "consent" } });
    expect(await add(u, "EAC9999103402", { statementVersion: "old" })).toMatchObject({ status: 409, body: { error: "consent_outdated" } });
    expect(await add(u, "nope")).toMatchObject({ status: 400, body: { error: "invalid_receipt", field: "receipt" } });
    const r = await add(u, "eac 9999103402", { nickname: "Mamá" });
    expect(r.status).toBe(201);
    const caseId = body(r).caseId as string;
    expect(await add(u, "EAC9999103402")).toMatchObject({ status: 409, body: { error: "duplicate" } });

    const list = await api.listCases(u);
    expect(body(list).cases).toHaveLength(1);
    expect(body(list).cases[0]).toMatchObject({ id: caseId, receiptMasked: "EAC*******402", nickname: "Mamá", statusTitleEn: "Case Was Received" });
    const detail = await api.getCase(u, caseId);
    expect(body(detail).case).toMatchObject({ id: caseId, consent: { basis: "SELF" }, events: [{ statusTitleEn: "Case Was Received" }] });
    const all = JSON.stringify([list.body, detail.body]);
    expect(all).not.toMatch(/9999103402|receiptEncrypted|receiptDigest/);

    expect(await api.refreshCase(u, caseId)).toMatchObject({ status: 429, body: { status: "cooldown" } });
    clock = new Date(clock.getTime() + 11 * 60_000);
    expect(await api.refreshCase(u, caseId)).toMatchObject({ status: 200, body: { status: "updated" } });

    const other = await mkUser();
    expect(await api.getCase(other, caseId)).toMatchObject({ status: 404 });
    expect(await api.refreshCase(other, caseId)).toMatchObject({ status: 404 });
    expect(await api.removeCase(other, caseId)).toMatchObject({ status: 404 });
    expect(await api.removeCase(u, caseId)).toMatchObject({ status: 200 });
    expect(body(await api.listCases(u)).cases).toHaveLength(0);
  });

  it("returns the profile and plan, and updates language and alerts with strict validation", async () => {
    const u = await mkUser("FREE");
    expect(body(await api.me(u))).toMatchObject({ locale: "es", plan: { id: "FREE", maxCases: 1 }, alerts: { email: true, push: false } });
    expect(await api.updateMe(u, { locale: "fr" })).toMatchObject({ status: 400, body: { field: "locale" } });
    expect(await api.updateMe(u, { plan: "PREMIUM" })).toMatchObject({ status: 400 }); // can't change plan from the app
    const r = await api.updateMe(u, { locale: "en", emailOnChange: false, name: " Ana " });
    expect(body(r)).toMatchObject({ locale: "en", name: "Ana", alerts: { email: false } });
    expect(await add(u, "EAC9999103402")).toMatchObject({ status: 201 });
    expect(await add(u, "EAC9999103403")).toMatchObject({ status: 403, body: { error: "plan_limit" } });
    expect(body(api.config()).consent.version).toBe(CONSENT_STATEMENT_VERSION);
  });

  it("registers push tokens (moving a token to whoever signs in), pushes status changes once, and drops dead tokens", async () => {
    const u = await mkUser();
    const v = await mkUser();
    const t1 = "ExponentPushToken[phoneOne123456]";
    const t2 = "ExponentPushToken[phoneTwo123456]";
    expect(await api.registerDevice(u, { token: "bad", platform: "ios" })).toMatchObject({ status: 400 });
    await api.registerDevice(v, { token: t1, platform: "ios" });
    await api.registerDevice(u, { token: t1, platform: "ios", appVersion: "1.0.0" });
    await api.registerDevice(u, { token: t2, platform: "android" });
    expect(await db.pushDevice.count({ where: { userId: u, disabledAt: null } })).toBe(2);
    expect(await db.pushDevice.count({ where: { userId: v } })).toBe(0);
    expect(body(await api.me(u)).alerts.push).toBe(true);

    title = "Case Was Received";
    const caseId = body(await add(u, "IOE0000000001", { nickname: "Mi I-485" })).caseId as string;
    title = "Case Was Approved";
    clock = new Date(clock.getTime() + 13 * 3600_000);
    const res = await cases.runCheck(await db.trackedCase.findUniqueOrThrow({ where: { id: caseId } }), "SCHEDULED");
    if (res.status !== "updated" || !res.eventId) throw new Error("no change");

    const pushed: PushMessage[] = [];
    const pusher: PushDriver = {
      name: "console",
      send: async (m) => (pushed.push(...m), m.map((x): PushResult => (x.to === t2 ? { status: "dead" } : { status: "ok" }))),
    };
    const emails: EmailMessage[] = [];
    const mailer: EmailDriver = { name: "console", send: async (m) => void emails.push(m) };
    expect(await notifyStatusChange(db, mailer, res.eventId, "https://casepingo.test", pusher)).toEqual({ sent: 2, skipped: 0, failed: 0 });
    expect(pushed.map((p) => p.to).sort()).toEqual([t1, t2].sort());
    expect(pushed[0]).toMatchObject({ title: "Actualización de su caso", data: { caseId } });
    expect(pushed[0].body).toContain("Mi I-485");
    expect(JSON.stringify(pushed)).not.toMatch(/0000000001/);
    expect(await db.pushDevice.findUniqueOrThrow({ where: { token: t2 } })).toMatchObject({ disabledAt: expect.any(Date) });

    // A retried job sends nothing twice.
    pushed.length = 0;
    expect(await notifyStatusChange(db, mailer, res.eventId, "https://casepingo.test", pusher)).toEqual({ sent: 0, skipped: 2, failed: 0 });
    expect(pushed).toHaveLength(0);

    // Push off in the app: no push.
    await api.updateMe(u, { pushOnChange: false });
    await api.unregisterDevice(u, { token: t1 });
    expect(await db.pushDevice.count({ where: { userId: u, disabledAt: null } })).toBe(0);
  });

  it("lets a Free user choose which case is checked", async () => {
    const u = await mkUser();
    const a = body(await add(u, "EAC9999103402")).caseId as string;
    const b = body(await add(u, "EAC9999103403")).caseId as string;
    await db.user.update({ where: { id: u }, data: { plan: "FREE" } });
    await db.trackedCase.update({ where: { id: b }, data: { trackingStatus: "PAUSED", pausedReason: "plan_limit" } });
    expect(body(await api.me(u)).cases).toEqual({ count: 2, pausedByPlan: 1 });
    expect(await api.checkInstead(u, a)).toMatchObject({ status: 404 }); // already checked
    expect(await api.checkInstead(u, b)).toMatchObject({ status: 200 });
    const rows = await db.trackedCase.findMany({ where: { ownerUserId: u } });
    expect(rows.find((r) => r.id === b)?.trackingStatus).toBe("ACTIVE");
    expect(rows.find((r) => r.id === a)?.trackingStatus).toBe("PAUSED");
  });
});
