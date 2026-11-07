/** Firm dashboard numbers against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import type { EmailDriver } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmDashboardService } from "../dashboard";
import { createFirmAlertService } from "../alerts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm dashboard", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-10-01T15:00:00Z");
  const now = () => clock;
  const statusFor = new Map<string, { title: string; form: string }>();
  const uscis: UscisPort = {
    mode: "mock",
    getCaseStatus: async (rc) => {
      const s = statusFor.get(rc) ?? { title: "Case Was Received", form: "I-130" };
      return { httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: s.title, formType: s.form } }, rc) };
    },
  };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const dash = createFirmDashboardService({ db, now });
  const alerts = createFirmAlertService({ db, now });
  const users: string[] = [];
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 on file" };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("counts the firm's own cases by status, form, category, assignee, country and waiting time, with filters", async () => {
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("Owner");
    const staff = await mk("Staff");
    const f = await firms.createFirm(owner, "Firm Dash");
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    const mx = await svc.createClient(owner, { firstName: "Ana", lastName: "Ruiz", countryOfBirth: "MX" });
    const in_ = await svc.createClient(owner, { firstName: "Raj", lastName: "Patel", countryOfBirth: "IN" });
    if (!mx.ok || !in_.ok) throw new Error();

    const add = async (clientId: string, receipt: string, title: string, form: string, assigneeId: string) => {
      statusFor.set(receipt, { title, form });
      const r = await svc.addCase(owner, { clientId, receipt, ...g28, assigneeId });
      if (!r.ok) throw new Error(r.error);
      return r.caseId;
    };
    await add(mx.clientId, "IOE0912360001", "Request for Additional Evidence Was Sent", "I-130", staff);
    await add(mx.clientId, "IOE0912360002", "Case Was Received", "I-485", staff);
    clock = new Date(clock.getTime() + 40 * 86_400_000);
    const late = await add(in_.clientId, "IOE0912360003", "Case Was Approved", "N-400", owner);
    await alerts.addDeadline(owner, late, { kind: "INTERVIEW", dueOn: new Date(clock.getTime() + 3 * 86_400_000).toISOString().slice(0, 10) });

    const d = (await dash.getDashboard(owner))!;
    expect(d.kpis).toMatchObject({ cases: 3, dueSoon: 1, noConsent: 0 });
    expect(d.byStatus.map((b) => [b.key, b.value])).toEqual([
      ["action", 1],
      ["progress", 1],
      ["done", 1],
    ]);
    expect(Object.fromEntries(d.byForm.map((b) => [b.label, b.value]))).toEqual({ "I-130": 1, "I-485": 1, "N-400": 1 });
    expect(Object.fromEntries(d.byCategory.map((b) => [b.key, b.value]))).toEqual({ family: 1, green_card: 1, citizenship: 1 });
    expect(Object.fromEntries(d.byAssignee.map((b) => [b.label, b.value]))).toEqual({ Staff: 2, Owner: 1 });
    expect(Object.fromEntries(d.byCountry.map((b) => [b.label, b.value]))).toEqual({ Mexico: 1, India: 1 });
    // The two unfinished cases last changed 40 days ago (the approved one is finished).
    expect(d.waiting.find((b) => b.key === "31-90")!.value).toBe(2);
    expect(d.deadlines.map((x) => [x.kind, x.daysLeft])).toEqual([["INTERVIEW", 3]]);

    const mine = (await dash.getDashboard(staff, { assignee: "me" }))!;
    expect(mine.kpis.cases).toBe(2);
    expect(mine.deadlines).toEqual([]);
    // "Added" dates are stamped by the database clock: set them to the test's clock.
    await db.trackedCase.updateMany({ where: { firmId: f.firm.id }, data: { createdAt: new Date(clock.getTime() - 40 * 86_400_000) } });
    await db.trackedCase.update({ where: { id: late }, data: { createdAt: clock } });
    const recent = (await dash.getDashboard(owner, { from: clock.toISOString().slice(0, 10) }))!;
    expect(recent.kpis.cases).toBe(1);
    expect((await dash.getDashboard(owner, { from: "not-a-date" }))!.kpis.cases).toBe(3);
  });
});
