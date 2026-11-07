/** Firm matters: grouping cases, filters, tasks and permissions (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmMatterService } from "../matters";
import { createFirmTaskService } from "../tasks";
import { createFirmDashboardService } from "../dashboard";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm matters", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-12-01T15:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const matters = createFirmMatterService({ db, now });
  const tasks = createFirmTaskService({ db, now });
  const dash = createFirmDashboardService({ db, now });
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

  it("groups cases into one matter each, filters by it, links tasks, and keeps firms apart", async () => {
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const staff = await mk("staff");
    const outsider = await mk("outsider");
    const f = await firms.createFirm(owner, "Firm Matters");
    const g = await firms.createFirm(outsider, "Firm Else");
    if (!f.ok || !g.ok) throw new Error();
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    const c = await svc.createClient(owner, { displayName: "García" });
    if (!c.ok) throw new Error();
    const ids: string[] = [];
    for (const r of ["IOE0912380001", "IOE0912380002", "IOE0912380003"]) {
      const a = await svc.addCase(owner, { clientId: c.clientId, receipt: r, basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28" });
      if (!a.ok) throw new Error(a.error);
      ids.push(a.caseId);
    }

    expect(await matters.create(staff, { name: "x" })).toMatchObject({ ok: false, field: "name" });
    const fam = await matters.create(staff, { name: "García family", kind: "FAMILY", description: "I-130 and I-485" });
    const emp = await matters.create(staff, { name: "Acme H-1B", kind: "EMPLOYER" });
    if (!fam.ok || !emp.ok) throw new Error();
    expect(await matters.create(owner, { name: "garcía FAMILY" })).toMatchObject({ ok: false, field: "name" });

    expect(await matters.setCasesMatter(staff, [ids[0]!, ids[1]!], fam.id)).toEqual({ ok: true, moved: 2 });
    expect(await matters.setCasesMatter(staff, [ids[0]!, ids[1]!], fam.id)).toEqual({ ok: true, moved: 0 });
    // A case is in one matter at a time: moving it takes it out of the other.
    expect(await matters.setCasesMatter(staff, [ids[1]!], emp.id)).toEqual({ ok: true, moved: 1 });
    // Another firm's matter or cases can't be used.
    const other = await matters.create(outsider, { name: "Theirs" });
    if (!other.ok) throw new Error();
    expect(await matters.setCasesMatter(staff, [ids[2]!], other.id)).toMatchObject({ ok: false, field: "matterId" });
    expect(await matters.setCasesMatter(outsider, [ids[2]!], other.id)).toEqual({ ok: true, moved: 0 });

    const listed = async (matter: string) => (await svc.listCases(staff, { matter }))!.cases.map((x) => x.receiptMasked).sort();
    expect(await listed(fam.id)).toEqual(["IOE*******001"]);
    expect(await listed(emp.id)).toEqual(["IOE*******002"]);
    expect(await listed("none")).toEqual(["IOE*******003"]);
    expect((await dash.getDashboard(staff, { matter: fam.id }))!.kpis.cases).toBe(1);

    // Tasks: linked to the matter directly or through one of its cases.
    const t1 = await tasks.create(staff, { title: "Family intake call", matterId: fam.id });
    const t2 = await tasks.create(staff, { title: "Case task", caseId: ids[0]! });
    const t3 = await tasks.create(staff, { title: "Other", caseId: ids[2]! });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error();
    expect(await tasks.create(staff, { title: "Bad", matterId: other.id })).toMatchObject({ ok: false, field: "matterId" });
    expect((await tasks.list(staff, { scope: "team", matterId: fam.id }))!.tasks.map((t) => t.title).sort()).toEqual(["Case task", "Family intake call"]);

    const l = (await matters.list(staff))!;
    expect(l.matters.map((m) => [m.name, m._count.cases, m._count.tasks])).toEqual([
      ["Acme H-1B", 1, 0],
      ["García family", 1, 1],
    ]);

    // Archiving: Owners and Admins only; archived matters can't take new cases.
    expect(await matters.setArchived(staff, fam.id, true)).toMatchObject({ ok: false });
    expect(await matters.setArchived(owner, fam.id, true)).toEqual({ ok: true });
    expect(await matters.setCasesMatter(owner, [ids[2]!], fam.id)).toMatchObject({ ok: false });
    expect((await matters.list(staff))!.matters.map((m) => m.name)).toEqual(["Acme H-1B"]);
    expect(await matters.setCasesMatter(owner, [ids[0]!], null)).toEqual({ ok: true, moved: 1 });

    const acts = (await db.auditLog.findMany({ where: { firmId: f.firm.id, OR: [{ action: { startsWith: "matter." } }, { action: { startsWith: "case.matter" } }] }, select: { action: true }, orderBy: { createdAt: "asc" } })).map((r) => r.action);
    expect(acts).toEqual(["matter.created", "matter.created", "case.matter_set", "case.matter_set", "matter.archived", "case.matter_cleared"]);
  });
});
