/** Team (Phase 6): titles, last active, personal notification settings, away/backup routing, staff emails, sync overview. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmUpdateService } from "../updates";
import { createFirmTeamService, inboxOwner } from "../team";
import { createFirmSyncService } from "../sync";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("team and personal settings", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-12-20T15:00:00Z");
  const now = () => clock;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const site = "https://casepingo.test";
  const firms = createFirmService({ db, mailer, siteUrl: site, now });
  const team = createFirmTeamService({ db, mailer, siteUrl: site, now });
  const updates = createFirmUpdateService({ db, mailer, siteUrl: site, now });
  const users: string[] = [];

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("labels people, tracks activity, routes items to a backup and emails who asked", async () => {
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const para = await mk("para");
    const other = await mk("other");
    const outsider = await mk("outsider");
    const f = await firms.createFirm(owner, "Firm Team");
    const g = await firms.createFirm(outsider, "Firm Else");
    if (!f.ok || !g.ok) throw new Error();
    await db.firmMembership.createMany({ data: [{ firmId: f.firm.id, userId: para, role: "STAFF" }, { firmId: f.firm.id, userId: other, role: "STAFF" }] });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    const paraM = await db.firmMembership.findFirstOrThrow({ where: { userId: para } });

    // Titles: managers only, known values.
    expect(await team.setTitle(para, paraM.id, "PARALEGAL")).toMatchObject({ ok: false });
    expect(await team.setTitle(owner, paraM.id, "WIZARD")).toMatchObject({ ok: false });
    expect(await team.setTitle(owner, paraM.id, "PARALEGAL")).toEqual({ ok: true });

    // Last active: written, then not again within a few minutes.
    await team.touch(para);
    const first = (await db.firmMembership.findUniqueOrThrow({ where: { id: paraM.id } })).lastActiveAt;
    expect(first).toEqual(clock);
    clock = new Date(clock.getTime() + 60_000);
    await team.touch(para);
    expect((await db.firmMembership.findUniqueOrThrow({ where: { id: paraM.id } })).lastActiveAt).toEqual(first);

    // Preferences: validation.
    const base = { inboxView: "mine", caseEmails: "mine", caseEmailKinds: ["action", "done"], awayUntil: "", backupUserId: "" };
    expect(await team.savePreferences(para, { ...base, caseEmailKinds: [] })).toMatchObject({ ok: false, field: "caseEmailKinds" });
    expect(await team.savePreferences(para, { ...base, awayUntil: "2027-12-01", backupUserId: other })).toMatchObject({ ok: false, field: "awayUntil" });
    expect(await team.savePreferences(para, { ...base, awayUntil: "2027-12-24" })).toMatchObject({ ok: false, field: "backupUserId" });
    expect(await team.savePreferences(para, { ...base, awayUntil: "2027-12-24", backupUserId: outsider })).toMatchObject({ ok: false, field: "backupUserId" });
    expect(await team.savePreferences(para, { ...base, awayUntil: "2027-12-24", backupUserId: para })).toMatchObject({ ok: false, field: "backupUserId" });
    expect(await team.savePreferences(para, base)).toEqual({ ok: true });
    expect((await team.preferences(para))!.prefs).toMatchObject({ inboxView: "mine", caseEmails: "mine", caseEmailKinds: ["action", "done"] });
    // The Inbox opens on the chosen view (the whole firm unless someone picks "assigned to me").
    expect((await updates.list(para))!.tab).toBe("mine");
    expect((await updates.list(owner))!.tab).toBe("open");

    // A case assigned to the paralegal changes: the inbox item goes to them, and they get an email (approvals are on).
    const c = await svc.createClient(owner, { displayName: "Ana Ruiz" });
    if (!c.ok) throw new Error();
    const added = await svc.addCase(owner, { clientId: c.clientId, receipt: "IOE0912499001", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28", assigneeId: para });
    if (!added.ok) throw new Error(added.error);
    await team.savePreferences(other, { ...base, caseEmails: "all", caseEmailKinds: ["stop"] });
    const change = async (title: string) => {
      clock = new Date(clock.getTime() + 3_600_000);
      const e = await db.caseStatusEvent.create({ data: { caseId: added.caseId, statusTitleEn: title, fingerprint: randomUUID(), firstObservedAt: clock } });
      return (await updates.recordStatusChange(e.id)).updateId!;
    };
    sent.length = 0;
    const u1 = await change("Case Was Approved");
    expect((await db.firmUpdate.findUniqueOrThrow({ where: { id: u1 } })).assignedToId).toBe(para);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toMatch(/^Case Was Approved: Ana Ruiz · \S+ IOE\*+001$/);
    expect(sent[0]!.body).toContain(`${site}/firm/cases/${added.caseId}`);
    // A denial: the colleague who asked for "every case, denials" hears too; progress emails nobody.
    sent.length = 0;
    await change("Case Was Denied");
    expect(sent).toHaveLength(1); // para didn't ask for denials; other did
    sent.length = 0;
    await change("Case Is Being Actively Reviewed By USCIS");
    expect(sent).toHaveLength(0);

    // Away: new items go to the backup until the end of the away day.
    expect(await team.savePreferences(para, { ...base, awayUntil: "2027-12-22", backupUserId: other })).toEqual({ ok: true });
    expect(await inboxOwner(db, f.firm.id, para, clock)).toBe(other);
    const u2 = await change("Request for Additional Evidence Was Sent");
    expect((await db.firmUpdate.findUniqueOrThrow({ where: { id: u2 } })).assignedToId).toBe(other);
    clock = new Date("2027-12-23T15:00:00Z");
    expect(await inboxOwner(db, f.firm.id, para, clock)).toBe(para);

    // Team page numbers.
    const people = (await team.people(owner))!.members;
    expect(people.find((p) => p.userId === para)).toMatchObject({ title: "PARALEGAL", cases: 1, openItems: 3 });
    expect(people.find((p) => p.userId === other)).toMatchObject({ openItems: 1 });
    expect(await db.auditLog.count({ where: { firmId: f.firm.id, action: "member.title" } })).toBe(1);

    // Sync overview.
    const sync = (await createFirmSyncService({ db, now }).overview(owner))!;
    expect(sync.schedule).toMatchObject({ everyHours: 12, running: true });
    expect(sync.counts.active).toBe(1);
    expect(sync.health).toBe("good");
    await db.trackedCase.update({ where: { id: added.caseId }, data: { lastCheckOutcome: "not_found" } });
    expect((await createFirmSyncService({ db, now }).overview(owner))!).toMatchObject({ health: "attention", counts: { failing: 1 } });
  });
});
