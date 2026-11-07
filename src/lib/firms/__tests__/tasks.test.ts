/** Firm tasks, comments, mentions, reminders and the calendar (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmTaskService, findMentions } from "../tasks";
import { createFirmUpdateService } from "../updates";
import { createFirmAlertService } from "../alerts";

const url = process.env.TEST_DATABASE_URL;
const DAY = 86_400_000;

describe("@mentions", () => {
  const team = [
    { id: "u1", name: "Ana Ruiz", email: "ana@firm.test" },
    { id: "u2", name: "Ana Rose", email: "arose@firm.test" },
    { id: "u3", name: null, email: "bob@firm.test" },
  ];
  it("finds teammates by full name, first name or email name, and ignores emails and near misses", () => {
    expect(findMentions("@Ana Ruiz please check", team)).toEqual(["u1"]);
    expect(findMentions("thanks @bob and @arose", team).sort()).toEqual(["u2", "u3"]);
    expect(findMentions("write to ana@firm.test", team)).toEqual([]);
    expect(findMentions("@Anastasia", team)).toEqual([]);
  });
});

describe.skipIf(!url)("firm tasks", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-11-01T15:00:00Z");
  const now = () => clock;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const tasks = createFirmTaskService({ db, now });
  const desk = createFirmUpdateService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const alerts = createFirmAlertService({ db, now });
  const users: string[] = [];
  const day = (offset: number) => new Date(clock.getTime() + offset * DAY).toISOString().slice(0, 10);
  const items = (firmId: string) => db.firmUpdate.findMany({ where: { firmId, kind: "TASK" }, select: { alertKey: true, assignedToId: true, state: true }, orderBy: { createdAt: "asc" } });

  const mk = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
    users.push(u.id);
    return u.id;
  };
  const mkFirm = async (name: string) => {
    const owner = await mk(`${name} Owner`);
    const staff = await mk(`${name} Staff`);
    const f = await firms.createFirm(owner, `Firm ${name}`);
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    return { firmId: f.firm.id, owner, staff };
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("creates, assigns, reminds, completes and lists tasks, inside one firm only", async () => {
    const a = await mkFirm("Tasker");
    const b = await mkFirm("Other");
    const client = await svc.createClient(a.owner, { displayName: "Ana Ruiz" });
    if (!client.ok) throw new Error();
    const added = await svc.addCase(a.owner, { clientId: client.clientId, receipt: "IOE0912370001", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28" });
    if (!added.ok) throw new Error(added.error);
    const otherClient = await svc.createClient(b.owner, { displayName: "Not yours" });
    if (!otherClient.ok) throw new Error();

    expect(await tasks.create(a.owner, { title: "  " })).toMatchObject({ ok: false, field: "title" });
    expect(await tasks.create(a.owner, { title: "X", clientId: otherClient.clientId })).toMatchObject({ ok: false, field: "clientId" });
    expect(await tasks.create(a.owner, { title: "X", assigneeId: b.owner })).toMatchObject({ ok: false, field: "assigneeId" });

    // Given to staff, due tomorrow, on the case: client filled from the case, two inbox items for staff.
    const t1 = await tasks.create(a.owner, { title: "Collect tax returns", type: "CLIENT_FOLLOW_UP", priority: "HIGH", dueOn: day(1), assigneeId: a.staff, caseId: added.caseId });
    if (!t1.ok) throw new Error(t1.error);
    expect(await db.firmTask.findUniqueOrThrow({ where: { id: t1.id } })).toMatchObject({ clientId: client.clientId, caseId: added.caseId });
    expect((await items(a.firmId)).map((u) => [u.alertKey!.split(":")[2], u.assignedToId])).toEqual([
      ["assigned", a.staff],
      ["due", a.staff],
    ]);
    // My own task: no "assigned" item.
    const t2 = await tasks.create(a.owner, { title: "Prepare I-485 packet", assigneeId: a.owner });
    if (!t2.ok) throw new Error();
    expect((await items(a.firmId)).length).toBe(2);

    const mine = (await tasks.list(a.staff, { scope: "mine" }))!;
    expect(mine.tasks.map((t) => t.title)).toEqual(["Collect tax returns"]);
    expect(mine.counts).toMatchObject({ mine: 1, team: 2 });
    expect((await tasks.list(a.staff, { scope: "team", priority: "HIGH" }))!.tasks.length).toBe(1);
    expect((await tasks.list(a.staff, { scope: "team", due: "none" }))!.tasks.map((t) => t.title)).toEqual(["Prepare I-485 packet"]);
    expect((await tasks.list(a.staff, { scope: "team", q: "ana" }))!.tasks.map((t) => t.title)).toEqual(["Collect tax returns"]);
    expect((await tasks.list(b.owner, { scope: "team" }))!.tasks).toEqual([]);
    expect(await tasks.get(b.owner, t1.id)).toBeNull();
    expect(await tasks.dueCount({ id: a.firmId, timeZone: "America/New_York" }, a.staff)).toBe(0);

    // The inbox shows the task item with its reason.
    const inbox = (await desk.list(a.staff, "mine"))!;
    expect(inbox.items.find((u) => u.kind === "TASK")).toMatchObject({ title: "Collect tax returns" });

    // Two days later it's overdue: the daily run adds one overdue item, once.
    clock = new Date(clock.getTime() + 2 * DAY);
    expect(await tasks.raiseDue({ id: a.firmId, timeZone: "America/New_York" })).toBe(1);
    expect(await tasks.raiseDue({ id: a.firmId, timeZone: "America/New_York" })).toBe(0);
    expect(await tasks.dueCount({ id: a.firmId, timeZone: "America/New_York" }, a.staff)).toBe(1);

    // Reassigning to the owner notifies the owner; a new due date clears stale reminders.
    const base = { title: "Collect tax returns", type: "CLIENT_FOLLOW_UP", priority: "HIGH", caseId: added.caseId, clientId: client.clientId };
    expect(await tasks.update(a.staff, t1.id, { ...base, assigneeId: a.owner, dueOn: day(10) })).toEqual({ ok: true });
    const after = await items(a.firmId);
    expect(after.filter((u) => /:(due|overdue):/.test(u.alertKey!) && u.state !== "DONE")).toEqual([]);
    expect(after.some((u) => u.alertKey === `task:${t1.id}:assigned:${a.owner}`)).toBe(true);

    // Done closes its inbox items and records who finished it; reopening works.
    expect(await tasks.update(a.owner, t1.id, { ...base, assigneeId: a.owner, dueOn: day(10), status: "DONE" })).toEqual({ ok: true });
    expect(await db.firmTask.findUniqueOrThrow({ where: { id: t1.id } })).toMatchObject({ status: "DONE", completedById: a.owner });
    expect((await items(a.firmId)).every((u) => u.state === "DONE")).toBe(true);
    expect(await tasks.setDone(a.staff, t1.id, false)).toEqual({ ok: true });
    expect(await db.firmTask.findUniqueOrThrow({ where: { id: t1.id } })).toMatchObject({ status: "TODO", completedAt: null });

    // Calendar: the task and the case deadline in the same month.
    await alerts.addDeadline(a.owner, added.caseId, { kind: "RFE_RESPONSE", dueOn: day(10) });
    const cal = (await tasks.calendar(a.owner, day(10).slice(0, 7), "team"))!;
    expect(cal.tasks.map((t) => t.title)).toContain("Collect tax returns");
    expect(cal.deadlines.map((d) => d.kind)).toEqual(["RFE_RESPONSE"]);

    // Staff can't delete the owner's task; the creator can.
    expect(await tasks.remove(a.staff, t2.id)).toMatchObject({ ok: false });
    expect(await tasks.remove(a.owner, t2.id)).toEqual({ ok: true });
    const acts = (await db.auditLog.findMany({ where: { firmId: a.firmId, action: { startsWith: "task." } }, select: { action: true }, orderBy: { createdAt: "asc" } })).map((r) => r.action);
    expect(acts).toEqual(["task.created", "task.created", "task.updated", "task.completed", "task.reopened", "task.deleted"]);
  });

  it("notifies @mentioned teammates once, never the author", async () => {
    const a = await mkFirm("Mention");
    const t = await tasks.create(a.owner, { title: "Draft cover letter", assigneeId: a.owner });
    if (!t.ok) throw new Error();
    const staffName = (await db.user.findUniqueOrThrow({ where: { id: a.staff } })).name!;
    expect(await tasks.addComment(a.owner, t.id, "")).toMatchObject({ ok: false, field: "body" });
    expect(await tasks.addComment(a.owner, t.id, `@${staffName} can you review? cc @Mention`)).toEqual({ ok: true, mentioned: 1 });
    const its = await items(a.firmId);
    expect(its.map((u) => [u.alertKey!.split(":")[2], u.assignedToId])).toEqual([["mention", a.staff]]);
    const got = (await tasks.get(a.staff, t.id))!;
    expect(got.task.comments.map((c) => c.mentions)).toEqual([[a.staff]]);
  });
});
