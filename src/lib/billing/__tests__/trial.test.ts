/** Free-plan limits and the Premium trial against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { protectReceipt } from "@/lib/cases/receipt-store";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { findDueCaseIds } from "@/lib/jobs/scheduler";
import { notifyStatusChange } from "@/lib/jobs/notifications";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { canonicalEmail, createTrialService, isDisposableEmail } from "../trial";

describe("trial email rules", () => {
  it("treats Gmail dots, +tags and googlemail as the same address", () => {
    expect(canonicalEmail("A.Mrullo+test@GoogleMail.com")).toBe("amrullo@gmail.com");
    expect(canonicalEmail("ana+cases@tsntech.org")).toBe("ana@tsntech.org");
    expect(canonicalEmail("a.na@tsntech.org")).toBe("a.na@tsntech.org"); // dots matter outside Gmail
  });
  it("spots throwaway email services", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@sub.yopmail.com")).toBe(true);
    expect(isDisposableEmail("x@gmail.com")).toBe(false);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Free plan and Premium trial", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-09-01T12:00:00Z");
  const now = () => clock;
  const days = (n: number) => (clock = new Date(clock.getTime() + n * 86_400_000));
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const trial = createTrialService({ db, mailer, siteUrl: "https://casepingo.test", now });
  let title = "Case Was Received";
  const uscis: UscisPort = {
    mode: "mock",
    getCaseStatus: async (r) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: r, current_case_status_text_en: title } }, r) }),
  };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const users: string[] = [];
  const tag = randomUUID().slice(0, 8);
  // Fingerprints outlive test accounts by design, so each run uses fresh receipt numbers.
  const rnd = () => `IOE${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`;
  const shared = rnd();
  const freeReceipt = rnd();
  const mkUser = async (email = `t-${randomUUID()}@test.dev`) => {
    const id = randomUUID();
    await db.user.create({ data: { id, email, name: "Trial" } });
    users.push(id);
    return { id, email };
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString("base64");
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("gives a new account 7 days of Premium once per email, even after deleting the account", async () => {
    const a = await mkUser(`ana.${tag}@gmail.com`);
    expect(await trial.grantNewAccountTrial(a.id, a.email)).toEqual({ granted: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(u.plan).toBe("PREMIUM");
    expect((u.trialEndsAt!.getTime() - clock.getTime()) / 86_400_000).toBe(7);

    await db.user.delete({ where: { id: a.id } });
    const again = await mkUser(`a.n.a.${tag}+new@googlemail.com`);
    expect(await trial.grantNewAccountTrial(again.id, again.email)).toEqual({ granted: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: again.id } })).plan).toBe("FREE");
  });

  it("ends a trial when the receipt number already had a trial on another account", async () => {
    const first = await mkUser();
    await trial.grantNewAccountTrial(first.id, first.email);
    expect(await cases.addCase(first.id, { receipt: shared, basis: "SELF" })).toMatchObject({ ok: true });
    // The same person removing and re-adding their own case keeps the trial.
    const c = await db.trackedCase.findFirstOrThrow({ where: { ownerUserId: first.id } });
    await cases.removeCase(first.id, c.id);
    expect(await cases.addCase(first.id, { receipt: shared, basis: "SELF" })).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: first.id } })).plan).toBe("PREMIUM");

    const second = await mkUser(`other-${tag}@test.dev`);
    await trial.grantNewAccountTrial(second.id, second.email);
    expect(await cases.addCase(second.id, { receipt: shared, basis: "SELF" })).toMatchObject({ ok: true });
    const s = await db.user.findUniqueOrThrow({ where: { id: second.id } });
    expect(s.plan).toBe("FREE");
    expect(s.trialEndsAt!.getTime()).toBeLessThanOrEqual(clock.getTime());
    expect(await db.trialLedger.count({ where: { key: { startsWith: "receipt:" } } })).toBeGreaterThan(0);
    expect(JSON.stringify(await db.trialLedger.findMany())).not.toContain(shared.slice(3));
    expect(JSON.stringify(await db.trialLedger.findMany())).not.toMatch(/@/);
  });

  it("Free: no automatic checks, no alerts, 3 manual checks a day with an upgrade message", async () => {
    const u = await mkUser();
    const added = await cases.addCase(u.id, { receipt: freeReceipt, basis: "SELF" });
    if (!added.ok) throw new Error();
    days(2);
    expect(await findDueCaseIds(db, clock)).not.toContain(added.caseId);

    title = "Case Was Approved";
    let lastEvent: string | undefined;
    for (let i = 0; i < 3; i++) {
      clock = new Date(clock.getTime() + 11 * 60_000);
      const r = await cases.refreshCase(u.id, added.caseId);
      expect(r.status).toBe("updated");
      if (r.status === "updated" && r.eventId) lastEvent = r.eventId;
    }
    clock = new Date(clock.getTime() + 11 * 60_000);
    expect(await cases.refreshCase(u.id, added.caseId)).toMatchObject({ status: "limit", message: expect.stringMatching(/Free plan includes 3 checks/) });

    sent.length = 0;
    expect(await notifyStatusChange(db, mailer, lastEvent!, "https://casepingo.test")).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("emails 2 days before the trial ends, then moves the account to Free with one case still checked", async () => {
    clock = new Date("2027-10-01T12:00:00Z");
    const u = await mkUser();
    await trial.grantNewAccountTrial(u.id, u.email);
    await db.trackedCase.createMany({
      data: ["EAC9999103402", "EAC9999103403"].map((r, i) => ({ ...protectReceipt(r), ownerUserId: u.id, createdAt: new Date(clock.getTime() + i * 1000) })),
    });
    days(4);
    sent.length = 0;
    await trial.runTrialJobs();
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(0);
    days(1.5);
    await trial.runTrialJobs();
    expect(sent.filter((m) => m.to === u.email).map((m) => m.subject)).toEqual(["Your CasePingo Premium trial ends soon"]);
    await trial.runTrialJobs();
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(1); // not twice

    days(2);
    await trial.runTrialJobs();
    expect(sent.filter((m) => m.to === u.email).map((m) => m.subject)).toContain("Your CasePingo trial has ended");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("FREE");
    const rows = await db.trackedCase.findMany({ where: { ownerUserId: u.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.trackingStatus)).toEqual(["ACTIVE", "PAUSED"]);
    await trial.runTrialJobs();
    expect(sent.filter((m) => m.subject === "Your CasePingo trial has ended" && m.to === u.email)).toHaveLength(1);
  });
});
