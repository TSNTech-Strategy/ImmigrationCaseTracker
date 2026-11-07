/** Case tags against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { CONSENT_STATEMENT_VERSION } from "@/lib/cases/consent";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { createMobileApi } from "@/lib/mobile/handlers";
import { createTagService, normalizeTagName, tagKey, TAG_COLORS, TAG_LIMITS } from "../tags";

describe("tag names", () => {
  it("trims, joins spaces and keeps capitals; one key per name whatever the capitals", () => {
    expect(normalizeTagName("  Family   cases ")).toBe("Family cases");
    expect(normalizeTagName("Mamá")).toBe("Mamá");
    expect(tagKey("Mamá")).toBe(tagKey("MAMÁ"));
    expect(normalizeTagName("")).toBeNull();
    expect(normalizeTagName("   ")).toBeNull();
    expect(normalizeTagName("x".repeat(TAG_LIMITS.name))).toHaveLength(TAG_LIMITS.name);
    expect(normalizeTagName("x".repeat(TAG_LIMITS.name + 1))).toBeNull();
    expect(normalizeTagName("bad\u0007bell")).toBeNull();
    expect(normalizeTagName(42)).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("case tags", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-08-01T12:00:00Z");
  const uscis: UscisPort = {
    mode: "mock",
    getCaseStatus: async (r) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: r, current_case_status_text_en: "Case Was Received" } }, r) }),
  };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const api = createMobileApi({ db, cases, now });
  const tags = createTagService({ db });
  const users: string[] = [];
  const firms: string[] = [];
  const body = (r: { body: unknown }) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const mkUser = async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `t-${id}@test.dev`, name: "Tags", plan: "PREMIUM" } });
    users.push(id);
    return id;
  };
  let receiptN = 103400;
  const addCase = async (u: string) => {
    const r = await api.addCase(u, { receipt: `EAC9999${receiptN++}`, basis: "SELF", consent: true, statementVersion: CONSENT_STATEMENT_VERSION });
    expect(r.status).toBe(201);
    return body(r).caseId as string;
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 2).toString("base64");
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.trackedCase.deleteMany({ where: { firmId: { in: firms } } });
    await db.firm.deleteMany({ where: { id: { in: firms } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("creates tags with different colors, A to Z, one per name whatever the capitals", async () => {
    const u = await mkUser();
    const a = await tags.create(u, { name: " Work " });
    const b = await tags.create(u, { name: "family" });
    const c = await tags.create(u, { name: "Mamá", color: "purple" });
    expect(a).toMatchObject({ ok: true, value: { name: "Work", color: TAG_COLORS[0] } });
    expect(b).toMatchObject({ ok: true, value: { name: "family", color: TAG_COLORS[1] } });
    expect(c).toMatchObject({ ok: true, value: { name: "Mamá", color: "purple" } });
    expect(await tags.create(u, { name: "FAMILY" })).toMatchObject({ ok: false, error: "duplicate" });
    expect(await tags.create(u, { name: "MAMÁ" })).toMatchObject({ ok: false, error: "duplicate" });
    expect(await tags.create(u, { name: "" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await tags.create(u, { name: "Ok", color: "pink" })).toMatchObject({ ok: false, error: "invalid" });
    expect((await tags.list(u)).map((t) => t.name)).toEqual(["family", "Mamá", "Work"]);
    // Someone else can use the same names.
    const other = await mkUser();
    expect(await tags.create(other, { name: "Family" })).toMatchObject({ ok: true });
  });

  it("stops at the per-person limit", async () => {
    const u = await mkUser();
    for (let i = 0; i < TAG_LIMITS.perPerson; i++) expect((await tags.create(u, { name: `Tag ${i}` })).ok).toBe(true);
    expect(await tags.create(u, { name: "One more" })).toMatchObject({ ok: false, error: "limit" });
  });

  it("puts tags on a case, replaces them, counts them, and keeps other people out", async () => {
    const u = await mkUser();
    const other = await mkUser();
    const caseId = await addCase(u);
    const otherCase = await addCase(other);
    const work = (await tags.create(u, { name: "Work" })) as { ok: true; value: { id: string } };
    const family = (await tags.create(u, { name: "Family" })) as { ok: true; value: { id: string } };
    const theirs = (await tags.create(other, { name: "Theirs" })) as { ok: true; value: { id: string } };

    const set = await tags.setCaseTags(u, caseId, [work.value.id, family.value.id, work.value.id]);
    expect(set).toMatchObject({ ok: true });
    expect(set.ok && set.value.map((t) => t.name)).toEqual(["Family", "Work"]);
    expect((await tags.list(u)).map((t) => [t.name, t.caseCount])).toEqual([["Family", 1], ["Work", 1]]);
    const replaced = await tags.setCaseTags(u, caseId, [family.value.id]);
    expect(replaced.ok && replaced.value.map((t) => t.name)).toEqual(["Family"]);
    expect(await tags.setCaseTags(u, caseId, [theirs.value.id])).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.setCaseTags(u, otherCase, [family.value.id])).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.setCaseTags(u, caseId, "nope")).toMatchObject({ ok: false, error: "invalid" });
    expect(await tags.setCaseTags(u, caseId, Array.from({ length: TAG_LIMITS.perCase + 1 }, (_, i) => `t${i}`))).toMatchObject({ ok: false, error: "limit" });
    const cleared = await tags.setCaseTags(u, caseId, []);
    expect(cleared).toMatchObject({ ok: true, value: [] });

    // Rename and recolor; other people's tags can't be changed or deleted.
    expect(await tags.update(u, work.value.id, { name: "Job", color: "green" })).toMatchObject({ ok: true, value: { name: "Job", color: "green" } });
    expect(await tags.update(u, work.value.id, { name: "family" })).toMatchObject({ ok: false, error: "duplicate" });
    expect(await tags.update(u, theirs.value.id, { name: "Mine" })).toMatchObject({ ok: false, error: "not_found" });
    expect(await tags.remove(u, theirs.value.id)).toMatchObject({ ok: false, error: "not_found" });

    // Deleting a tag takes it off the case; the case stays.
    await tags.setCaseTags(u, caseId, [family.value.id, work.value.id]);
    expect(await tags.remove(u, family.value.id)).toMatchObject({ ok: true });
    expect(await db.trackedCaseTag.findMany({ where: { caseId }, select: { tagId: true } })).toEqual([{ tagId: work.value.id }]);
    expect(await db.trackedCase.count({ where: { id: caseId } })).toBe(1);
  });

  it("the database itself refuses a tag on someone else's case or on a firm case", async () => {
    const u = await mkUser();
    const other = await mkUser();
    const otherCase = await addCase(other);
    const mine = (await tags.create(u, { name: "Mine" })) as { ok: true; value: { id: string } };
    await expect(db.trackedCaseTag.create({ data: { caseId: otherCase, tagId: mine.value.id, ownerUserId: u } })).rejects.toThrow();
    await expect(db.trackedCaseTag.create({ data: { caseId: otherCase, tagId: mine.value.id, ownerUserId: other } })).rejects.toThrow();

    const firm = await db.firm.create({ data: { name: "Tag Test Firm", trialEndsAt: new Date("2027-09-01T00:00:00Z") } });
    firms.push(firm.id);
    const firmCase = await db.trackedCase.create({ data: { firmId: firm.id, receiptEncrypted: "x", receiptDigest: `d-${randomUUID()}`, receiptMasked: "EAC*******000" } });
    await expect(db.trackedCaseTag.create({ data: { caseId: firmCase.id, tagId: mine.value.id, ownerUserId: u } })).rejects.toThrow();
    expect(await tags.setCaseTags(u, firmCase.id, [mine.value.id])).toMatchObject({ ok: false, error: "not_found" });
  });

  it("removing a case or the account removes its tag links and tags", async () => {
    const u = await mkUser();
    const caseId = await addCase(u);
    const t = (await tags.create(u, { name: "Gone soon" })) as { ok: true; value: { id: string } };
    await tags.setCaseTags(u, caseId, [t.value.id]);
    expect(await api.removeCase(u, caseId)).toMatchObject({ status: 200 });
    expect(await db.trackedCaseTag.count({ where: { tagId: t.value.id } })).toBe(0);
    expect(await db.caseTag.count({ where: { id: t.value.id } })).toBe(1);
    await db.user.delete({ where: { id: u } });
    expect(await db.caseTag.count({ where: { id: t.value.id } })).toBe(0);
  });

  it("the app API: list with colors and limits, create, set on a case, and tags on the case list and case", async () => {
    const u = await mkUser();
    const caseId = await addCase(u);
    expect(body(await api.listTags(u))).toEqual({ tags: [], colors: [...TAG_COLORS], limits: TAG_LIMITS });
    const created = await api.createTag(u, { name: "Family" });
    expect(created).toMatchObject({ status: 201, body: { tag: { name: "Family", color: "blue" } } });
    expect(await api.createTag(u, { name: "family" })).toMatchObject({ status: 409, body: { error: "duplicate", field: "name" } });
    expect(await api.createTag(u, { name: "x".repeat(30) })).toMatchObject({ status: 400, body: { error: "invalid", field: "name" } });
    const id = body(created).tag.id as string;
    expect(await api.setCaseTags(u, caseId, { tagIds: [id] })).toMatchObject({ status: 200, body: { tags: [{ id, name: "Family", color: "blue" }] } });
    expect(await api.setCaseTags(u, "missing", { tagIds: [id] })).toMatchObject({ status: 404 });
    expect(body(await api.listCases(u)).cases[0].tags).toEqual([{ id, name: "Family", color: "blue" }]);
    expect(body(await api.getCase(u, caseId)).case.tags).toEqual([{ id, name: "Family", color: "blue" }]);
    expect(await api.updateTag(u, id, { color: "red" })).toMatchObject({ status: 200, body: { tag: { color: "red" } } });
    expect(body(await api.listTags(u)).tags).toEqual([{ id, name: "Family", color: "red", caseCount: 1 }]);
    expect(await api.deleteTag(u, id)).toMatchObject({ status: 200, body: { deleted: true } });
    expect(await api.deleteTag(u, id)).toMatchObject({ status: 404 });
    expect(body(await api.getCase(u, caseId)).case.tags).toEqual([]);
  });
});
