/** Stuck-case alerts and case deadlines against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import type { EmailDriver } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmUpdateService } from "../updates";
import { createFirmAlertService, easternDay, suggestedDeadline } from "../alerts";

const url = process.env.TEST_DATABASE_URL;
const DAY = 86_400_000;

describe("deadline suggestions from a status", () => {
  it("suggests the deadline a notice usually carries, never for a received response", () => {
    expect(suggestedDeadline("Request for Additional Evidence Was Sent")).toBe("RFE_RESPONSE");
    expect(suggestedDeadline("Response To USCIS' Request For Evidence Was Received")).toBeNull();
    expect(suggestedDeadline("Notice of Intent to Deny Was Sent")).toBe("NOID_RESPONSE");
    expect(suggestedDeadline("Interview Was Scheduled")).toBe("INTERVIEW");
    expect(suggestedDeadline("Fingerprint Review Was Scheduled")).toBe("BIOMETRICS");
    expect(suggestedDeadline("Case Was Approved")).toBeNull();
    expect(easternDay(new Date("2027-06-02T03:30:00Z"))).toBe("2027-06-01"); // still June 1 in New York
  });
});

describe.skipIf(!url)("stuck cases and deadlines", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-08-01T15:00:00Z");
  const now = () => clock;
  let respond: ((r: string) => ReturnType<typeof mockFetchCaseStatus>) | null = null;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => (respond ? respond(r) : mockFetchCaseStatus(r)) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const desk = createFirmUpdateService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const alerts = createFirmAlertService({ db, now });
  const users: string[] = [];
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 on file" };

  const mkUser = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
    users.push(u.id);
    return u.id;
  };
  const mkFirm = async (name: string) => {
    const owner = await mkUser(`${name}-owner`);
    const staff = await mkUser(`${name}-staff`);
    const f = await firms.createFirm(owner, `Firm ${name}`);
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } }); // past the trial: a paying firm
    return { firmId: f.firm.id, owner, staff };
  };
  const mkCase = async (userId: string, receipt: string, title = "Case Is Being Actively Reviewed By USCIS") => {
    const c = await svc.createClient(userId, { displayName: `Client ${receipt.slice(-3)}` });
    if (!c.ok) throw new Error(c.error);
    // USCIS gives no "modified" date here, so days count from when we saw the change.
    respond = async (rc) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: title, form_type: "I-485" } }, rc) });
    const r = await svc.addCase(userId, { clientId: c.clientId, receipt, nickname: null, ...g28 });
    if (!r.ok) throw new Error(r.error);
    return r.caseId;
  };
  const later = (days: number) => {
    clock = new Date(clock.getTime() + days * DAY);
  };
  const day = (offset: number) => new Date(clock.getTime() + offset * DAY).toISOString().slice(0, 10);
  const itemsOf = async (firmId: string) => db.firmUpdate.findMany({ where: { firmId }, orderBy: { createdAt: "asc" }, select: { kind: true, state: true, alertKey: true, stuckDays: true, deadlineId: true } });

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("flags a case after the firm's quiet period, once per status, never finished ones, and closes it when USCIS moves", async () => {
    const a = await mkFirm("Stuck");
    const firm = { id: a.firmId, stuckAfterDays: 90 };
    const quiet = await mkCase(a.owner, "IOE0912340001");
    await mkCase(a.owner, "IOE0912340002", "Case Was Denied"); // finished: never stuck

    later(89);
    expect(await alerts.raiseStuck(firm)).toBe(0);
    later(2);
    expect(await alerts.raiseStuck(firm)).toBe(1);
    expect(await alerts.raiseStuck(firm)).toBe(0); // the daily run is safe to repeat
    expect((await alerts.runDaily()).stuck).toBe(0);
    expect(await itemsOf(a.firmId)).toEqual([expect.objectContaining({ kind: "STUCK", state: "OPEN", stuckDays: 91 })]);

    const list = await desk.list(a.staff, "open");
    expect(list!.items[0]).toMatchObject({ title: "No change from USCIS in 91 days", client: { displayName: "Client 001" }, preview: null });
    expect(await desk.openCount(a.firmId, a.staff)).toBe(1);
    // An alert has no client email: Send does nothing.
    expect(await desk.act(a.owner, list!.items[0].id, { type: "send" })).toMatchObject({ ok: false, code: "nothing_waiting" });

    // USCIS moves the case: the stuck alert closes by itself and a status change arrives instead.
    later(1);
    respond = async (rc) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: "Interview Was Scheduled", form_type: "I-485" } }, rc) });
    const res = await cases.runCheck(await db.trackedCase.findUniqueOrThrow({ where: { id: quiet } }), "SCHEDULED");
    await desk.recordStatusChange(res.status === "updated" ? res.eventId! : "");
    expect((await itemsOf(a.firmId)).map((u) => [u.kind, u.state])).toEqual([
      ["STUCK", "DONE"],
      ["STATUS_CHANGE", "OPEN"],
    ]);
    // Another long wait on the new status raises a new alert.
    later(95);
    expect(await alerts.raiseStuck(firm)).toBe(1);
    // Off means off.
    later(30);
    await db.firmUpdate.deleteMany({ where: { firmId: a.firmId, kind: "STUCK" } });
    expect(await alerts.raiseStuck({ id: a.firmId, stuckAfterDays: 0 })).toBe(0);
  });

  it("keeps deadlines: checks the input, reminds before and when overdue, closes reminders when done", async () => {
    const a = await mkFirm("Due");
    const b = await mkFirm("Other");
    const caseId = await mkCase(a.owner, "IOE0912340010", "Request for Additional Evidence Was Sent");

    expect(await alerts.addDeadline(a.staff, caseId, { kind: "RFE_RESPONSE", dueOn: "2027-13-01" })).toMatchObject({ ok: false, field: "dueOn" });
    expect(await alerts.addDeadline(a.staff, caseId, { kind: "OTHER", dueOn: day(10) })).toMatchObject({ ok: false, field: "note" });
    expect(await alerts.addDeadline(a.staff, caseId, { kind: "BOGUS", dueOn: day(10) })).toMatchObject({ ok: false, field: "kind" });
    expect(await alerts.addDeadline(b.owner, caseId, { kind: "RFE_RESPONSE", dueOn: day(10) })).toMatchObject({ ok: false, error: "Case not found." });

    // Due in 3 days, inside the 7-day lead: reminded right away. Due in 20 days: not yet.
    const soon = await alerts.addDeadline(a.staff, caseId, { kind: "RFE_RESPONSE", dueOn: day(3), note: "  Send   by FedEx " });
    const far = await alerts.addDeadline(a.staff, caseId, { kind: "INTERVIEW", dueOn: day(20) });
    if (!soon.ok || !far.ok) throw new Error("add failed");
    expect(await db.caseDeadline.findUniqueOrThrow({ where: { id: soon.id } })).toMatchObject({ note: "Send by FedEx" });
    expect((await itemsOf(a.firmId)).map((u) => u.alertKey)).toEqual([`deadline:${soon.id}:soon`]);
    const first = (await desk.list(a.owner, "open"))!.items[0];
    expect(first.title).toMatch(/^RFE response due: /);
    expect(first.nextStep).toBe("In 3 days · Send by FedEx");

    // Two weeks on: the RFE is overdue, the interview is close.
    later(14);
    expect(await alerts.raiseDeadlines({ id: a.firmId, deadlineLeadDays: 7 })).toBe(2);
    expect(await alerts.raiseDeadlines({ id: a.firmId, deadlineLeadDays: 7 })).toBe(0);
    expect((await itemsOf(a.firmId)).map((u) => u.alertKey).sort()).toEqual([`deadline:${far.id}:soon`, `deadline:${soon.id}:overdue`, `deadline:${soon.id}:soon`].sort());
    const overdue = (await desk.list(a.owner, "open"))!.items.find((u) => u.overdue);
    expect(overdue?.nextStep).toMatch(/^Overdue by 11 days/);
    const listed = await alerts.firmDeadlines(a.owner);
    expect(listed!.open.map((d) => d.kind)).toEqual(["RFE_RESPONSE", "INTERVIEW"]);

    // Done closes its reminders; another firm can't touch it.
    expect(await alerts.setDeadlineDone(b.owner, soon.id, true)).toMatchObject({ ok: false });
    expect(await alerts.setDeadlineDone(a.staff, soon.id, true)).toEqual({ ok: true });
    const states = await db.firmUpdate.findMany({ where: { deadlineId: soon.id }, select: { state: true } });
    expect(states.map((s) => s.state)).toEqual(["DONE", "DONE"]);
    expect(await desk.openCount(a.firmId, a.owner)).toBe(1);
    // Reopened: the overdue reminder comes back.
    expect(await alerts.setDeadlineDone(a.staff, soon.id, false)).toEqual({ ok: true });
    expect((await db.firmUpdate.findMany({ where: { deadlineId: soon.id }, select: { alertKey: true, state: true } }))).toEqual([{ alertKey: `deadline:${soon.id}:overdue`, state: "OPEN" }]);
    // Removed: its reminders go with it.
    expect(await alerts.removeDeadline(a.owner, soon.id)).toEqual({ ok: true });
    expect(await db.firmUpdate.count({ where: { deadlineId: soon.id } })).toBe(0);

    const actions = (await db.auditLog.findMany({ where: { firmId: a.firmId, action: { startsWith: "deadline." } }, select: { action: true }, orderBy: { createdAt: "asc" } })).map((r) => r.action);
    expect(actions).toEqual(["deadline.added", "deadline.added", "deadline.done", "deadline.reopened", "deadline.removed"]);
  });

  it("lets only an Owner or Admin change alert settings, and applies them at once", async () => {
    const a = await mkFirm("Settings");
    await mkCase(a.owner, "IOE0912340020");
    later(70);
    expect(await alerts.saveAlertSettings(a.staff, { stuckAfterDays: 60, deadlineLeadDays: 14 })).toMatchObject({ ok: false });
    expect(await alerts.saveAlertSettings(a.owner, { stuckAfterDays: 45, deadlineLeadDays: 14 })).toMatchObject({ ok: false, field: "stuckAfterDays" });
    expect(await alerts.saveAlertSettings(a.owner, { stuckAfterDays: 60, deadlineLeadDays: 14 })).toEqual({ ok: true });
    expect(await db.firm.findUniqueOrThrow({ where: { id: a.firmId } })).toMatchObject({ stuckAfterDays: 60, deadlineLeadDays: 14 });
    expect((await itemsOf(a.firmId)).map((u) => u.kind)).toEqual(["STUCK"]); // 70 days quiet ≥ 60
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "firm.alerts" } })).toBe(1);
  });
});
