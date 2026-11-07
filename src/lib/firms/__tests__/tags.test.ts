/** Firm tags against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { createTagService } from "@/lib/cases/tags";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { describeAudit } from "../audit";
import { createFirmCaseService } from "../cases";
import { createFirmImportService } from "../import";
import { createFirmService } from "../service";
import { createFirmTagService, FIRM_TAG_LIMITS, nextTagColor } from "../tags";

describe("firm tag helpers", () => {
  it("picks the least-used color and describes tag activity in plain English", () => {
    expect(nextTagColor([])).toBe("blue");
    expect(nextTagColor([{ color: "blue" }, { color: "green" }])).toBe("amber");
    expect(describeAudit("tag.created", { name: "H-1B", color: "green" }, "")).toBe('Created tag "H-1B"');
    expect(describeAudit("tag.created", { name: "H-1B", source: "csv" }, "")).toBe('Created tag "H-1B" (CSV import)');
    expect(describeAudit("tag.updated", { from: "Atty Smith", to: "Attorney: Smith", fromColor: "blue", color: "blue" }, "")).toBe('Renamed tag "Atty Smith" to "Attorney: Smith"');
    expect(describeAudit("tag.updated", { from: "Urgent", to: "Urgent", fromColor: "blue", color: "red" }, "")).toBe('Made tag "Urgent" red');
    expect(describeAudit("tag.deleted", { name: "Old", cases: 3 }, "")).toBe('Deleted tag "Old" (it came off 3 cases)');
    expect(describeAudit("case.tags_changed", { added: ["H-1B", "Urgent"], removed: ["Old"] }, "EAC*******402")).toBe('Changed tags on case EAC*******402: added "H-1B", "Urgent"; took off "Old"');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm tags", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-05-01T12:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => mockFetchCaseStatus(r) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const tags = createFirmTagService({ db });
  const imp = createFirmImportService({ db, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 signed 2027-04-01" };
  let receiptN = 103500;

  const mkUser = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
    users.push(u.id);
    return u.id;
  };
  const mkFirm = async (name: string) => {
    const owner = await mkUser(`${name}-owner`);
    const staff = await mkUser(`${name}-staff`);
    const f = await firms.createFirm(owner, `Tags ${name}`);
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    const client = await svc.createClient(owner, { displayName: `${name} Client` });
    if (!client.ok) throw new Error(client.error);
    return { firmId: f.firm.id, owner, staff, clientId: client.clientId };
  };
  const mkCase = async (f: { owner: string; clientId: string }) => {
    const r = await svc.addCase(f.owner, { clientId: f.clientId, receipt: `EAC9999${receiptN++}`, ...g28 });
    if (!r.ok) throw new Error(r.error);
    return r.caseId;
  };
  const tagOf = async (userId: string, name: string, color?: string) => {
    const r = await tags.create(userId, { name, color });
    if (!r.ok) throw new Error(r.message);
    return r.value.id;
  };
  const actions = async (firmId: string) => (await db.auditLog.findMany({ where: { firmId, action: { startsWith: "tag." } }, orderBy: { createdAt: "asc" } })).map((a) => a.action);

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("everyone in the firm creates and uses tags; only Owners and Admins rename, recolor and delete them", async () => {
    const a = await mkFirm("A");
    const outsider = await mkUser("outsider");
    expect(await tags.create(outsider, { name: "Nope" })).toMatchObject({ ok: false, error: "not_found" });
    const h1b = await tagOf(a.staff, "H-1B");
    expect(await tags.create(a.owner, { name: "h-1b" })).toMatchObject({ ok: false, error: "duplicate" });
    expect(await tags.create(a.owner, { name: "x".repeat(FIRM_TAG_LIMITS.name + 1) })).toMatchObject({ ok: false, error: "invalid" });
    expect(await tags.create(a.owner, { name: "Attorney: Jennifer Rivera-Smith" })).toMatchObject({ ok: true }); // 31 characters: fits the firm limit
    expect(await tags.update(a.staff, h1b, { name: "H1B" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await tags.remove(a.staff, h1b)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await tags.update(a.owner, h1b, { name: "H-1B cap", color: "purple" })).toMatchObject({ ok: true, value: { name: "H-1B cap", color: "purple" } });
    const listed = await tags.list(a.staff);
    expect(listed?.canManage).toBe(false);
    expect((await tags.list(a.owner))?.canManage).toBe(true);
    expect(listed?.tags.map((t) => t.name)).toEqual(["Attorney: Jennifer Rivera-Smith", "H-1B cap"]);
    expect(await actions(a.firmId)).toEqual(["tag.created", "tag.created", "tag.updated"]);
    const updated = await db.auditLog.findFirst({ where: { firmId: a.firmId, action: "tag.updated" } });
    expect(updated?.metadata).toMatchObject({ from: "H-1B", to: "H-1B cap", color: "purple" });
  });

  it("stops at the firm's tag limit", async () => {
    const a = await mkFirm("Limit");
    await db.firmTag.createMany({ data: Array.from({ length: FIRM_TAG_LIMITS.perFirm }, (_, i) => ({ firmId: a.firmId, name: `T${i}`, nameKey: `t${i}` })) });
    expect(await tags.create(a.staff, { name: "One more" })).toMatchObject({ ok: false, error: "limit" });
  });

  it("puts tags on the firm's cases, logs who changed what, filters and searches by tag, and keeps other firms out", async () => {
    const a = await mkFirm("Cases");
    const b = await mkFirm("Other");
    const c1 = await mkCase(a);
    const c2 = await mkCase(a);
    const otherCase = await mkCase(b);
    const rivera = await tagOf(a.owner, "Attorney: Rivera");
    const rfe = await tagOf(a.owner, "RFE due");
    const theirs = await tagOf(b.owner, "Theirs");

    const set = await tags.setCaseTags(a.staff, c1, [rivera, rfe]);
    expect(set.ok && set.value.map((t) => t.name)).toEqual(["Attorney: Rivera", "RFE due"]);
    expect(await tags.setCaseTags(a.staff, c1, [rivera])).toMatchObject({ ok: true });
    await tags.setCaseTags(a.staff, c2, [rfe]);
    const changes = await db.auditLog.findMany({ where: { firmId: a.firmId, action: "case.tags_changed", targetId: c1 }, orderBy: { createdAt: "asc" } });
    expect(changes.map((x) => x.metadata)).toEqual([
      { added: ["Attorney: Rivera", "RFE due"], removed: [] },
      { added: [], removed: ["RFE due"] },
    ]);
    expect(changes[0].actorUserId).toBe(a.staff);

    expect(await tags.setCaseTags(a.owner, c1, [theirs])).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.setCaseTags(a.owner, otherCase, [rivera])).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.setCaseTags(b.owner, c1, [theirs])).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.setCaseTags(a.owner, c1, Array.from({ length: FIRM_TAG_LIMITS.perCase + 1 }, (_, i) => `t${i}`))).toMatchObject({ ok: false, error: "limit" });

    const byTag = await svc.listCases(a.staff, { tagId: rivera });
    expect(byTag!.cases.map((c) => c.id)).toEqual([c1]);
    expect(byTag!.cases[0].tags).toEqual([{ id: rivera, name: "Attorney: Rivera", color: expect.any(String) }]);
    expect((await svc.listCases(a.staff, { q: "rivera" }))!.cases.map((c) => c.id)).toEqual([c1]);
    expect((await svc.listCases(a.staff, { tagId: theirs }))!.cases).toEqual([]);
    expect((await svc.getCase(a.owner, c2))!.case.firmTags.map(({ tag }) => tag.name)).toEqual(["RFE due"]);
    expect((await svc.getClient(a.owner, a.clientId))!.client.cases.map((c) => c.tags.map((t) => t.name))).toEqual([["RFE due"], ["Attorney: Rivera"]]);
    expect((await tags.list(a.owner))!.tags.map((t) => [t.name, t.caseCount])).toEqual([["Attorney: Rivera", 1], ["RFE due", 1]]);

    // Deleting a tag takes it off its cases and says how many in the log.
    expect(await tags.remove(a.owner, rfe)).toMatchObject({ ok: true });
    expect(await db.firmCaseTag.count({ where: { tagId: rfe } })).toBe(0);
    expect((await db.auditLog.findFirst({ where: { firmId: a.firmId, action: "tag.deleted" } }))?.metadata).toEqual({ name: "RFE due", cases: 1 });
  });

  it("the database itself refuses a firm tag on another firm's case or on a personal case", async () => {
    const a = await mkFirm("Db");
    const b = await mkFirm("Db2");
    const otherCase = await mkCase(b);
    const mine = await tagOf(a.owner, "Mine");
    await expect(db.firmCaseTag.create({ data: { caseId: otherCase, tagId: mine, firmId: a.firmId } })).rejects.toThrow();
    await expect(db.firmCaseTag.create({ data: { caseId: otherCase, tagId: mine, firmId: b.firmId } })).rejects.toThrow();
    const person = await mkUser("person");
    const personal = await db.trackedCase.create({ data: { ownerUserId: person, receiptEncrypted: "x", receiptDigest: `d-${randomUUID()}`, receiptMasked: "EAC*******000" } });
    await expect(db.firmCaseTag.create({ data: { caseId: personal.id, tagId: mine, firmId: a.firmId } })).rejects.toThrow();
    // And personal tags still can't go on firm cases.
    const personalTag = await createTagService({ db }).create(person, { name: "Mine" });
    expect(personalTag.ok).toBe(true);
    await expect(db.trackedCaseTag.create({ data: { caseId: otherCase, tagId: (personalTag as { value: { id: string } }).value.id, ownerUserId: person } })).rejects.toThrow();
  });

  it("CSV import: a tags column matches existing tags, creates new ones once, and checks the limits", async () => {
    const a = await mkFirm("Csv");
    const existing = await tagOf(a.owner, "Attorney: Rivera");
    const csv = [
      "client_name,receipt_number,tags",
      `Ana Ruiz,EAC9999${receiptN++},attorney: rivera; H-1B`,
      `Ben Cho,EAC9999${receiptN++},H-1B | Priority`,
      `Cy Diaz,EAC9999${receiptN++},${"y".repeat(FIRM_TAG_LIMITS.name + 1)}`,
      `Di Eng,EAC9999${receiptN++},${Array.from({ length: FIRM_TAG_LIMITS.perCase + 1 }, (_, i) => `Tag${i}`).join(";")}`,
      `Ed Fox,EAC9999${receiptN++},`,
    ].join("\n");
    const plan = await imp.preview(a.owner, csv, g28);
    expect(plan).toMatchObject({ ok: true, toAdd: 3, newTags: 2, errors: 2 });
    const rows = (plan as { rows: { tags: { name: string; isNew: boolean }[]; error: string | null }[] }).rows;
    expect(rows[0].tags).toEqual([{ name: "Attorney: Rivera", isNew: false }, { name: "H-1B", isNew: true }]);
    expect(rows[1].tags).toEqual([{ name: "H-1B", isNew: true }, { name: "Priority", isNew: true }]);
    expect(rows[2].error).toMatch(/longer than 32 characters/);
    expect(rows[3].error).toMatch(/up to 10 tags/);
    expect(rows[4].tags).toEqual([]);

    expect(await imp.run(a.owner, csv, g28)).toMatchObject({ ok: true, added: 3, newTags: 2, skipped: 2 });
    const firmTags = await db.firmTag.findMany({ where: { firmId: a.firmId }, select: { id: true, name: true, color: true, _count: { select: { cases: true } } }, orderBy: { nameKey: "asc" } });
    expect(firmTags.map((t) => [t.name, t._count.cases])).toEqual([["Attorney: Rivera", 1], ["H-1B", 2], ["Priority", 1]]);
    expect(firmTags.find((t) => t.id === existing)?._count.cases).toBe(1);
    expect(new Set(firmTags.map((t) => t.color)).size).toBe(3); // new tags get colors not used yet
    const created = await db.auditLog.findMany({ where: { firmId: a.firmId, action: "tag.created" }, orderBy: { createdAt: "asc" } });
    expect(created.slice(1).map((x) => x.metadata)).toEqual([expect.objectContaining({ name: "H-1B", source: "csv" }), expect.objectContaining({ name: "Priority", source: "csv" })]);
    expect((await db.auditLog.findFirst({ where: { firmId: a.firmId, action: "cases.imported" } }))?.metadata).toMatchObject({ added: 3, newTags: 2 });
  });
});
