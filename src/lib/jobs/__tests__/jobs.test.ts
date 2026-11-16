/** Scheduler + notifications against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { protectReceipt } from "@/lib/cases/receipt-store";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { findDueCaseIds, pickFairly, runScheduledCheck, scheduledAllowance, uscisLooksDown } from "../scheduler";
import { estimateCapacity } from "../capacity";
import { notifyStatusChange } from "../notifications";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("scheduler and notifications", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let owner: string;
  const t0 = new Date("2027-03-01T12:00:00Z");
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };

  const makeCase = async (receipt: string, extra: Record<string, unknown> = {}, consent = true) =>
    db.trackedCase.create({
      data: {
        ...protectReceipt(receipt),
        ownerUserId: owner,
        ...extra,
        ...(consent ? { consents: { create: { basis: "SELF", source: "WEB", statementVersion: "t" } } } : {}),
      },
    });

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 6).toString("base64");
    owner = (await db.user.create({ data: { id: randomUUID(), email: `owner-${randomUUID()}@test.dev`, name: "Owner", plan: "PREMIUM" } })).id;
  });
  beforeEach(async () => {
    sent.length = 0;
    await db.trackedCase.deleteMany({ where: { ownerUserId: owner } });
    await db.notificationPreference.deleteMany({ where: { userId: owner } });
  });
  afterAll(async () => {
    await db.user.delete({ where: { id: owner } });
    await db.$disconnect();
  });

  it("selects only due, active, consented cases, oldest first", async () => {
    const never = await makeCase("EAC0000000001");
    const due = await makeCase("EAC0000000002", { nextCheckAt: new Date(t0.getTime() - 60_000) });
    await makeCase("EAC0000000003", { nextCheckAt: new Date(t0.getTime() + 60_000) }); // not yet
    await makeCase("EAC0000000004", { trackingStatus: "PAUSED" });
    await makeCase("EAC0000000005", {}, false); // no consent
    const withdrawn = await makeCase("EAC0000000006");
    await db.caseConsent.updateMany({ where: { caseId: withdrawn.id }, data: { withdrawnAt: t0 } });

    const ids = await findDueCaseIds(db, t0);
    const mine = ids.filter((id) => [never.id, due.id].includes(id) || ids.length < 50);
    expect(ids).toContain(never.id);
    expect(ids).toContain(due.id);
    expect(ids.indexOf(never.id)).toBeLessThan(ids.indexOf(due.id));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    const all = await db.trackedCase.findMany({ where: { ownerUserId: owner }, select: { id: true } });
    const excluded = all.map((c) => c.id).filter((id) => id !== never.id && id !== due.id);
    for (const id of excluded) expect(ids).not.toContain(id);
  });

  it("runs a check only when still due (duplicate events are harmless)", async () => {
    const service = createCaseService({ db, uscis: { mode: "mock", getCaseStatus: mockFetchCaseStatus }, now: () => t0 });
    const c = await makeCase("EAC9999103402");
    const first = await runScheduledCheck(db, service, c.id, t0);
    expect(first).toMatchObject({ checked: true, status: "updated", changed: true });
    const again = await runScheduledCheck(db, service, c.id, t0);
    expect(again).toEqual({ checked: false, reason: "not_due" });
    expect(await runScheduledCheck(db, service, "missing-id", t0)).toEqual({ checked: false, reason: "missing" });
  });

  it("reports a change with the event id when the status moves", async () => {
    let title = "Case Was Received";
    const uscis = {
      mode: "mock" as const,
      getCaseStatus: async (r: string) => ({
        httpStatus: 200,
        attempts: 1,
        durationMs: 1,
        snapshot: normalizeCaseStatus({ case_status: { receiptNumber: r, current_case_status_text_en: title } }, r),
      }),
    };
    let now = t0;
    const service = createCaseService({ db, uscis, now: () => now });
    const c = await makeCase("EAC9999103403");
    await runScheduledCheck(db, service, c.id, now);
    now = new Date(t0.getTime() + 13 * 3600_000);
    const same = await runScheduledCheck(db, service, c.id, now);
    expect(same).toMatchObject({ checked: true, changed: false });
    title = "Case Was Approved";
    now = new Date(now.getTime() + 13 * 3600_000);
    const moved = await runScheduledCheck(db, service, c.id, now);
    expect(moved).toMatchObject({ checked: true, changed: true, eventId: expect.any(String) });
  });

  it("emails the owner once per change, in their language, with the masked receipt only", async () => {
    await db.user.update({ where: { id: owner }, data: { locale: "es" } });
    const c = await makeCase("EAC9999103402", { nickname: "Mamá I-130" });
    const e = await db.caseStatusEvent.create({
      data: { caseId: c.id, fingerprint: "f1", statusTitleEn: "Case Was Approved", statusTitleEs: "Caso Fue Aprobado", formType: "I-130" },
    });
    expect(await notifyStatusChange(db, mailer, e.id, "https://ict.example")).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(await notifyStatusChange(db, mailer, e.id, "https://ict.example")).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Actualización de su caso: Caso Fue Aprobado");
    expect(sent[0].body).toContain("EAC*******402");
    expect(sent[0].body).not.toContain("9999103402");
    expect(sent[0].body).toContain(`https://ict.example/cases/${c.id}`);
    await db.user.update({ where: { id: owner }, data: { locale: "en" } });
  });

  it("respects email alerts being off", async () => {
    await db.notificationPreference.create({ data: { userId: owner, emailOnChange: false } });
    const c = await makeCase("EAC9999103402");
    const e = await db.caseStatusEvent.create({ data: { caseId: c.id, fingerprint: "f2", statusTitleEn: "X" } });
    expect(await notifyStatusChange(db, mailer, e.id, "https://ict.example")).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(0);
    expect((await db.notificationDelivery.findFirst({ where: { eventId: e.id } }))?.status).toBe("SKIPPED");
  });

  it("records a failed send, then succeeds on retry without duplicating", async () => {
    const c = await makeCase("EAC9999103402");
    const e = await db.caseStatusEvent.create({ data: { caseId: c.id, fingerprint: "f3", statusTitleEn: "Y" } });
    const flaky: EmailDriver = { name: "smtp", send: async () => Promise.reject(new Error("SMTP down")) };
    await expect(notifyStatusChange(db, flaky, e.id, "https://ict.example")).rejects.toThrow("SMTP down");
    expect((await db.notificationDelivery.findFirst({ where: { eventId: e.id } }))?.status).toBe("FAILED");
    expect(await notifyStatusChange(db, mailer, e.id, "https://ict.example")).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(await db.notificationDelivery.count({ where: { eventId: e.id } })).toBe(1);
  });

  it("pauses when USCIS calls are failing in bulk with no successes", async () => {
    const c = await makeCase("EAC9999103402");
    const at = new Date("2030-01-01T00:00:00Z");
    expect(await uscisLooksDown(db, at)).toBe(false);
    await db.caseCheckRun.createMany({
      data: Array.from({ length: 20 }, () => ({ caseId: c.id, trigger: "SCHEDULED" as const, uscisEnv: "mock", outcome: "server", durationMs: 1, attemptedAt: at })),
    });
    expect(await uscisLooksDown(db, at)).toBe(true);
    await db.caseCheckRun.create({ data: { caseId: c.id, trigger: "SCHEDULED", uscisEnv: "mock", outcome: "ok", durationMs: 1, attemptedAt: at } });
    expect(await uscisLooksDown(db, at)).toBe(false);
  });

  it("shares a tick fairly between accounts, most overdue first within each", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `big${i}`, firmId: "big", ownerUserId: null })),
      { id: "fam1", firmId: null, ownerUserId: "u1" },
      { id: "small1", firmId: "small", ownerUserId: null },
      { id: "small2", firmId: "small", ownerUserId: null },
    ];
    expect(pickFairly(rows, 4)).toEqual(["big0", "fam1", "small1", "big1"]);
    expect(pickFairly(rows, 100)).toHaveLength(8);
    expect(pickFairly(rows, 0)).toEqual([]);
  });

  it("spreads what's left of today's automatic budget over the ticks left, keeping 20% for Check now", async () => {
    const c = await makeCase("EAC9999103402");
    const morning = new Date("2031-05-05T00:00:00Z"); // start of a UTC day: 96 ticks left
    expect(await scheduledAllowance(db, morning, { budget: 960 })).toBe(8); // 768 / 96
    // Only 48 ticks when USCIS can answer: twice as many per tick.
    expect(await scheduledAllowance(db, morning, { budget: 960, isOpen: (at) => at.getUTCHours() >= 12 })).toBe(16);
    await db.caseCheckRun.createMany({
      data: Array.from({ length: 768 }, () => ({ caseId: c.id, trigger: "SCHEDULED" as const, uscisEnv: "mock", httpStatus: 200, outcome: "ok", durationMs: 1, attemptedAt: new Date("2031-05-05T00:00:01Z") })),
    });
    expect(await scheduledAllowance(db, new Date("2031-05-05T06:00:00Z"), { budget: 960 })).toBe(0);
  });

  it("estimates the daily checks automatic cases need, by cadence", async () => {
    const at = new Date("2032-01-01T12:00:00Z");
    const old = new Date("2031-01-01T00:00:00Z");
    await makeCase("EAC9999103402", { statusTitleEn: "Interview Was Scheduled", createdAt: old, lastChangeObservedAt: old }); // active: 2/day
    await makeCase("EAC9999103403", { statusTitleEn: "Case Was Received", createdAt: old, lastChangeObservedAt: old }); // quiet: 0.5/day
    await makeCase("EAC9999103404", { statusTitleEn: "Case Was Denied", createdAt: old, lastChangeObservedAt: old }); // settled: 1/7 a day
    await makeCase("EAC9999103405", { statusTitleEn: "Case Was Received", trackingStatus: "PAUSED" }); // not counted
    const cap = await estimateCapacity(db, at, 100);
    const mine = { active: 1, steady: 0, quiet: 1, settled: 1 };
    // Other tests' cases may share the database: check our three at least, and the arithmetic.
    expect(cap.byTier.active).toBeGreaterThanOrEqual(mine.active);
    expect(cap.byTier.quiet).toBeGreaterThanOrEqual(mine.quiet);
    expect(cap.byTier.settled).toBeGreaterThanOrEqual(mine.settled);
    expect(cap.scheduledBudget).toBe(80);
    expect(cap.utilization).toBeCloseTo(cap.checksPerDay / 80, 1);
    expect(cap.roomForActiveCases).toBe(Math.floor(Math.max(0, 80 - cap.checksPerDay) / 2));
  });
});
