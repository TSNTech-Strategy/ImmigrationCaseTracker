/** Firm documents: type checks, encryption at rest, firm isolation, permissions (TEST_DATABASE_URL for the DB part). */
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { createLocalFileStore } from "@/lib/storage/file-store";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { cleanFileName, createFirmDocumentService, MAX_FILE_BYTES, sniffType } from "../documents";

const url = process.env.TEST_DATABASE_URL;
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 0x41), Buffer.from("\n%%EOF")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

describe("document checks", () => {
  it("recognises files by their first bytes, not their names", () => {
    expect(sniffType(PDF, "passport.pdf")).toBe("application/pdf");
    expect(sniffType(PNG, "photo.jpg")).toBe("image/png");
    expect(sniffType(Buffer.from("MZ\x90\x00 not a pdf"), "evil.pdf")).toBeNull();
    expect(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), "archive.zip")).toBeNull();
    expect(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), "letter.docx")).toContain("wordprocessingml");
  });
  it("keeps file names safe", () => {
    expect(cleanFileName("C:\\Users\\ana\\..\\passport<1>.pdf")).toBe("passport1.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName(`${"a".repeat(300)}.pdf`)).toMatch(/^a{196}\.pdf$/);
    expect(cleanFileName("   ")).toBe("document");
  });
});

describe.skipIf(!url)("firm documents", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-12-10T15:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  let dir = "";

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
    dir = await mkdtemp(join(tmpdir(), "docs-test-"));
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  it("stores files encrypted, serves them only to the firm, and limits changes to the uploader and managers", async () => {
    const docs = createFirmDocumentService({ db, store: createLocalFileStore(dir) });
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const staff = await mk("staff");
    const staff2 = await mk("staff2");
    const outsider = await mk("outsider");
    const f = await firms.createFirm(owner, "Firm Docs");
    const g = await firms.createFirm(outsider, "Firm Other");
    if (!f.ok || !g.ok) throw new Error();
    await db.firmMembership.createMany({ data: [{ firmId: f.firm.id, userId: staff, role: "STAFF" }, { firmId: f.firm.id, userId: staff2, role: "STAFF" }] });
    const c = await svc.createClient(owner, { displayName: "Ana Ruiz" });
    if (!c.ok) throw new Error();
    const added = await svc.addCase(owner, { clientId: c.clientId, receipt: "IOE0912390001", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28" });
    if (!added.ok) throw new Error(added.error);

    expect(await docs.upload(staff, { data: Buffer.alloc(0), name: "x.pdf" })).toMatchObject({ ok: false, field: "file" });
    expect(await docs.upload(staff, { data: Buffer.alloc(MAX_FILE_BYTES + 1, 0x25), name: "big.pdf" })).toMatchObject({ ok: false, field: "file" });
    expect(await docs.upload(staff, { data: Buffer.from("hello"), name: "notes.txt" })).toMatchObject({ ok: false, field: "file" });
    expect(await docs.upload(staff, { data: PDF, name: "a.pdf", visibility: "CLIENT" })).toMatchObject({ ok: false, field: "visibility" });
    expect(await docs.upload(outsider, { data: PDF, name: "a.pdf", caseId: added.caseId })).toMatchObject({ ok: false, field: "caseId" });

    const up = await docs.upload(staff, { data: PDF, name: "I-797C notice.pdf", kind: "USCIS_NOTICE", caseId: added.caseId });
    if (!up.ok) throw new Error(up.error);
    const row = await db.firmDocument.findUniqueOrThrow({ where: { id: up.id } });
    expect(row).toMatchObject({ clientId: c.clientId, contentType: "application/pdf", size: PDF.length, source: "FIRM", visibility: "INTERNAL" });
    // At rest the file is ciphertext, not the PDF.
    const [firmDir] = await readdir(dir);
    const [stored] = await readdir(join(dir, firmDir!));
    const raw = await readFile(join(dir, firmDir!, stored!));
    expect(raw.includes(Buffer.from("%PDF"))).toBe(false);
    expect(raw.length).toBe(PDF.length + 28);

    const dl = await docs.download(owner, up.id);
    expect(dl).toMatchObject({ ok: true, name: "I-797C notice.pdf", contentType: "application/pdf" });
    if (dl.ok) expect(dl.data.equals(PDF)).toBe(true);
    expect(await docs.download(outsider, up.id)).toMatchObject({ ok: false });
    expect((await docs.list(outsider))!.documents).toEqual([]);
    expect((await docs.list(owner, { caseId: added.caseId }))!.documents.map((d) => d.name)).toEqual(["I-797C notice.pdf"]);
    expect((await docs.list(owner, { kind: "IDENTITY" }))!.documents).toEqual([]);

    // Another staff member can't change or delete it; the uploader and the owner can.
    expect(await docs.update(staff2, up.id, { visibility: "CLIENT" })).toMatchObject({ ok: false });
    expect(await docs.update(staff, up.id, { visibility: "CLIENT" })).toEqual({ ok: true });
    expect(await docs.remove(staff2, up.id)).toMatchObject({ ok: false });
    expect(await docs.remove(owner, up.id)).toEqual({ ok: true });
    expect(await readdir(join(dir, firmDir!))).toEqual([]);
    const acts = (await db.auditLog.findMany({ where: { firmId: f.firm.id, action: { startsWith: "document." } }, select: { action: true }, orderBy: { createdAt: "asc" } })).map((r) => r.action);
    expect(acts).toEqual(["document.uploaded", "document.downloaded", "document.updated", "document.deleted"]);

    // Without storage, uploads are refused cleanly.
    const off = createFirmDocumentService({ db, store: null });
    expect(await off.upload(owner, { data: PDF, name: "a.pdf" })).toMatchObject({ ok: false, error: expect.stringMatching(/storage/) });
  });
});
