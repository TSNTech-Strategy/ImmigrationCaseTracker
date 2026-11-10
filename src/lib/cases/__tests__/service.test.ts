/**
 * Case service against a real Postgres (TEST_DATABASE_URL; skipped otherwise).
 * Covers the guide's threat tests (§19.3): user isolation, consent, quota.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "../service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { UscisError } from "@/lib/uscis/errors";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { revealReceipt } from "../receipt-store";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("case service", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let alice: string, bob: string;
  let clock = new Date("2026-11-05T15:00:00Z");
  const calls: string[] = [];
  const logs: Record<string, unknown>[] = [];
  let nextResponse: ((r: string) => Promise<ReturnType<typeof mockFetchCaseStatus> extends Promise<infer T> ? T : never>) | null = null;

  const uscis = (mode: UscisPort["mode"] = "mock"): UscisPort => ({
    mode,
    getCaseStatus: async (r) => {
      calls.push(r);
      return nextResponse ? nextResponse(r) : mockFetchCaseStatus(r);
    },
  });
  const service = (mode: UscisPort["mode"] = "mock", env: Record<string, string | undefined> = {}) =>
    createCaseService({ db, uscis: uscis(mode), now: () => clock, env, log: (e) => logs.push(e) });
  const minutes = (n: number) => (clock = new Date(clock.getTime() + n * 60_000));

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 5).toString("base64");
    alice = (await db.user.create({ data: { id: randomUUID(), email: `alice-${randomUUID()}@test.dev` } })).id;
    bob = (await db.user.create({ data: { id: randomUUID(), email: `bob-${randomUUID()}@test.dev` } })).id;
  });
  beforeEach(async () => {
    await db.user.updateMany({ where: { id: { in: [alice, bob] } }, data: { plan: "PREMIUM" } });
    calls.length = 0;
    logs.length = 0;
    nextResponse = null;
    clock = new Date(clock.getTime() + 24 * 3600_000); // fresh day each test
    await db.trackedCase.deleteMany({ where: { ownerUserId: { in: [alice, bob] } } });
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: { in: [alice, bob] } } });
    await db.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    await db.$disconnect();
  });

  it("adds a case: encrypted receipt, consent, audit entry, first check and event", async () => {
    const r = await service().addCase(alice, { receipt: "eac 9999103402", nickname: "Mine", basis: "SELF" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.check.status).toBe("updated");
    const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId }, include: { consents: true, events: true, checkRuns: true } });
    expect(c.receiptMasked).toBe("EAC*******402");
    expect(c.receiptEncrypted).not.toContain("9999103402");
    expect(revealReceipt(c)).toBe("EAC9999103402");
    expect(c.consents).toHaveLength(1);
    expect(c.consents[0]).toMatchObject({ basis: "SELF", source: "WEB", grantedById: alice });
    expect(c.statusTitleEn).toBe("Case Approval Was Affirmed");
    expect(c.events).toHaveLength(1);
    expect(c.checkRuns[0]).toMatchObject({ trigger: "INITIAL", outcome: "ok", httpStatus: 200 });
    expect(c.lastCheckedAt).toEqual(clock);
    expect(c.lastChangeObservedAt).toEqual(clock);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: "case.created" } })).toBe(1);
  });

  it("never stores the full receipt number from USCIS's status text", async () => {
    nextResponse = async (receipt) => ({
      httpStatus: 200,
      attempts: 1,
      durationMs: 1,
      snapshot: normalizeCaseStatus(
        { case_status: { receiptNumber: receipt, current_case_status_text_en: "Approved", current_case_status_desc_en: `Receipt Number ${receipt}, was approved.` } },
        receipt,
      ),
    });
    const r = await service().addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    const rows = await db.$queryRaw<unknown[]>`SELECT * FROM "TrackedCase" WHERE id = ${r.caseId}`;
    const events = await db.$queryRaw<unknown[]>`SELECT * FROM "CaseStatusEvent" WHERE "caseId" = ${r.caseId}`;
    expect(JSON.stringify([rows, events])).not.toContain("9999103402");
    expect(JSON.stringify(rows)).toContain("Receipt Number EAC*******402");
  });

  it("rejects invalid, duplicate and over-plan-limit adds", async () => {
    await db.user.update({ where: { id: alice }, data: { plan: "FREE" } });
    const s = service();
    expect(await s.addCase(alice, { receipt: "123", basis: "SELF" })).toMatchObject({ ok: false, error: "invalid_receipt" });
    await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    expect(await s.addCase(alice, { receipt: "EAC-9999-103402", basis: "SELF" })).toMatchObject({ ok: false, error: "duplicate" });
    // Free plan: 1 case.
    expect(await s.addCase(alice, { receipt: "EAC9999103403", basis: "SELF" })).toMatchObject({ ok: false, error: "limit" });
    await db.user.update({ where: { id: alice }, data: { plan: "PREMIUM" } });
    expect((await s.addCase(alice, { receipt: "EAC9999103403", basis: "SELF" })).ok).toBe(true);
    // Bob can track the same receipt independently.
    expect((await s.addCase(bob, { receipt: "EAC9999103402", basis: "AUTHORIZED_BY_APPLICANT" })).ok).toBe(true);
  });

  it("isolates users: Bob can't list, read, refresh or remove Alice's case", async () => {
    const r = await service().addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error("add failed");
    const s = service();
    expect(await s.listCases(bob)).toEqual([]);
    expect(await s.getCase(bob, r.caseId)).toBeNull();
    minutes(60);
    expect(await s.refreshCase(bob, r.caseId)).toMatchObject({ status: "not_found" });
    expect(await s.removeCase(bob, r.caseId)).toBe(false);
    expect(await db.trackedCase.count({ where: { id: r.caseId } })).toBe(1);
    // Alice still can.
    expect(await s.getCase(alice, r.caseId)).not.toBeNull();
  });

  it("enforces the manual refresh cooldown", async () => {
    const s = service();
    const r = await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    expect((await s.refreshCase(alice, r.caseId)).status).toBe("cooldown");
    minutes(11);
    expect((await s.refreshCase(alice, r.caseId)).status).toBe("updated");
    expect(calls).toHaveLength(2);
  });

  it("lets only one of two simultaneous refreshes call USCIS", async () => {
    const s = service();
    const r = await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    minutes(11);
    calls.length = 0;
    const results = await Promise.all([s.refreshCase(alice, r.caseId), s.refreshCase(alice, r.caseId)]);
    expect(results.map((x) => x.status).sort()).toEqual(["cooldown", "updated"]);
    expect(calls).toHaveLength(1);
  });

  it("records an event only when the status changes", async () => {
    const s = service();
    const r = await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    minutes(11);
    expect(await s.refreshCase(alice, r.caseId)).toMatchObject({ status: "updated", changed: false });
    nextResponse = async (receipt) => ({
      httpStatus: 200,
      attempts: 1,
      durationMs: 5,
      snapshot: normalizeCaseStatus(
        { case_status: { receiptNumber: receipt, formType: "I-130", current_case_status_text_en: "Card Was Mailed To Me" } },
        receipt,
      ),
    });
    minutes(11);
    const changed = await s.refreshCase(alice, r.caseId);
    expect(changed).toMatchObject({ status: "updated", changed: true, eventId: expect.any(String) });
    const c = await s.getCase(alice, r.caseId);
    expect(c?.events.map((e) => e.statusTitleEn)).toEqual(["Card Was Mailed To Me", "Case Approval Was Affirmed"]);
    expect(c?.statusTitleEn).toBe("Card Was Mailed To Me");
  });

  it("does not call USCIS without active consent", async () => {
    const s = service();
    const r = await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    await db.caseConsent.updateMany({ where: { caseId: r.caseId }, data: { withdrawnAt: clock } });
    minutes(11);
    calls.length = 0;
    expect((await s.refreshCase(alice, r.caseId)).status).toBe("no_consent");
    expect(calls).toHaveLength(0);
  });

  it("in sandbox mode only sends USCIS sample receipts", async () => {
    const s = service("sandbox");
    const real = await s.addCase(alice, { receipt: "IOE0912345678", basis: "SELF" });
    expect(real.ok && real.check.status).toBe("failed");
    expect(calls).toEqual([]);
    const sample = await s.addCase(alice, { receipt: "EAC9999103403", basis: "SELF" });
    expect(sample.ok && sample.check.status).toBe("updated");
    expect(calls).toEqual(["EAC9999103403"]);
  });

  it("stops at the global daily USCIS budget", async () => {
    const s = service("mock", { USCIS_DAILY_BUDGET: "1" });
    await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    const second = await s.addCase(bob, { receipt: "EAC9999103403", basis: "SELF" });
    expect(second.ok && second.check.status).toBe("budget");
    expect(calls).toHaveLength(1);
  });

  it("records failures with a friendly message and backoff", async () => {
    nextResponse = async () => {
      throw new UscisError("server", "HTTP 503", { httpStatus: 503 });
    };
    const r = await service().addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    expect(r.check).toMatchObject({ status: "failed", message: expect.stringMatching(/unavailable right now/) });
    const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId } });
    expect(c).toMatchObject({ lastCheckOutcome: "server", lastCheckHttpStatus: 503, lastCheckUscisMessage: null, consecutiveFailures: 1 });
    expect(c.nextCheckAt!.getTime() - clock.getTime()).toBe(3600_000);
  });

  it("shows, stores and logs USCIS's own error message, receipt masked", async () => {
    nextResponse = async (receipt) => {
      throw new UscisError("not_found", "HTTP 404", {
        httpStatus: 404,
        details: [{ code: "404", message: `Case Status Online does not recognize ${receipt}.`, traceId: "t-123" }],
      });
    };
    const r = await service().addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    expect(r.check.message).toMatch(/doesn't recognize this receipt number/);
    expect(r.check.message).toContain('USCIS said (HTTP 404): "Case Status Online does not recognize EAC*******402."');

    const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId }, include: { checkRuns: true } });
    expect(c).toMatchObject({ lastCheckHttpStatus: 404, lastCheckUscisMessage: "Case Status Online does not recognize EAC*******402." });
    expect(c.checkRuns[0]).toMatchObject({ httpStatus: 404, uscisErrorCode: "404", uscisTraceId: "t-123" });
    expect(JSON.stringify(c)).not.toContain("9999103402");

    expect(logs).toEqual([expect.objectContaining({ event: "uscis.check_failed", httpStatus: 404, receipt: "EAC*******402", uscisTraceId: "t-123" })]);
    expect(JSON.stringify(logs)).not.toContain("9999103402");

    // A later success clears USCIS's message.
    nextResponse = null;
    minutes(11);
    await service().refreshCase(alice, r.caseId);
    expect(await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId } })).toMatchObject({ lastCheckOutcome: "ok", lastCheckHttpStatus: 200, lastCheckUscisMessage: null });
  });

  it("removes a case and leaves an audit record", async () => {
    const s = service();
    const r = await s.addCase(alice, { receipt: "EAC9999103402", basis: "SELF" });
    if (!r.ok) throw new Error();
    expect(await s.removeCase(alice, r.caseId)).toBe(true);
    expect(await db.trackedCase.count({ where: { id: r.caseId } })).toBe(0);
    expect(await db.auditLog.count({ where: { targetId: r.caseId, action: "case.removed" } })).toBe(1);
  });
});

describe.skipIf(!url)("check cadence by plan", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  afterAll(() => db.$disconnect());
  it("schedules the next check in 24h on Free and 12h on Premium", async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 5).toString("base64");
    const t = new Date("2027-01-01T10:00:00Z");
    const s = createCaseService({ db, uscis: { mode: "mock", getCaseStatus: mockFetchCaseStatus }, now: () => t });
    for (const [plan, hours] of [["FREE", 24], ["PREMIUM", 12]] as const) {
      const u = await db.user.create({ data: { id: randomUUID(), email: `cadence-${randomUUID()}@test.dev`, plan } });
      const r = await s.addCase(u.id, { receipt: "EAC9999103402", basis: "SELF" });
      if (!r.ok) throw new Error("add failed");
      const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId } });
      expect((c.nextCheckAt!.getTime() - t.getTime()) / 3600_000).toBe(hours);
      await db.user.delete({ where: { id: u.id } });
    }
  });
});
