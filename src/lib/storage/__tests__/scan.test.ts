/** Upload scanning: built-in checks, the Cloudmersive answer handling, and that refused files are never stored. */
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { basicScan, cloudmersiveScanner, createUploadScanner } from "../scan";
import { createLocalFileStore } from "../file-store";
import { createFirmService } from "@/lib/firms/service";
import { createFirmDocumentService } from "@/lib/firms/documents";
import type { EmailDriver } from "@/lib/email";

const PDF_TYPE = "application/pdf";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF`, "latin1");
const docx = (...names: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(["[Content_Types].xml", "word/document.xml", ...names].join("\x00"), "latin1")]);
const jpeg = (extra = Buffer.alloc(0)) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7), extra]);

describe("built-in checks", () => {
  it("lets ordinary documents through, including PDF form scripts", () => {
    expect(basicScan(pdf("1 0 obj << /Type /Catalog /AcroForm 2 0 R >> endobj"), PDF_TYPE)).toEqual({ ok: true, method: "basic" });
    expect(basicScan(pdf("<< /S /JavaScript /JS (this.calculate=true) >>"), PDF_TYPE)).toMatchObject({ ok: true });
    expect(basicScan(docx("word/styles.xml", "word/media/image1.png"), DOCX_TYPE)).toMatchObject({ ok: true });
    expect(basicScan(jpeg(), "image/jpeg")).toMatchObject({ ok: true });
  });
  it("refuses files that run things", () => {
    expect(basicScan(pdf("<< /S /Launch /F (cmd.exe) >>"), PDF_TYPE)).toMatchObject({ ok: false, detail: expect.stringMatching(/opens programs/) });
    expect(basicScan(pdf("<< /Type /EmbeddedFile /F (invoice.exe) >>"), PDF_TYPE)).toMatchObject({ ok: false, detail: expect.stringMatching(/attached program/) });
    expect(basicScan(pdf("<< /Type /EmbeddedFile /F (receipt.xml) >>"), PDF_TYPE)).toMatchObject({ ok: true });
    expect(basicScan(docx("word/vbaProject.bin"), DOCX_TYPE)).toMatchObject({ ok: false, detail: "docx:active-content" });
    expect(basicScan(docx("word/activeX/activeX1.xml"), DOCX_TYPE)).toMatchObject({ ok: false });
    expect(basicScan(docx("word/embeddings/oleObject1.bin"), DOCX_TYPE)).toMatchObject({ ok: false });
    expect(basicScan(docx("application/vnd.ms-word.document.macroEnabled.main+xml"), DOCX_TYPE)).toMatchObject({ ok: false });
    // A photo with a Windows program stuck on the end.
    const exe = Buffer.concat([Buffer.from("MZ\x90\x00", "latin1"), Buffer.alloc(60), Buffer.from("This program cannot be run in DOS mode", "latin1")]);
    expect(basicScan(jpeg(exe), "image/jpeg")).toMatchObject({ ok: false, reason: expect.stringMatching(/hidden program/) });
  });
});

describe("Cloudmersive scan", () => {
  const answer = (body: object, status = 200) => (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  it("accepts clean files and refuses infected ones", async () => {
    let sent: { url: string; headers: Record<string, string> } | null = null;
    const spy = (async (url: string, init: RequestInit) => {
      sent = { url, headers: init.headers as Record<string, string> };
      return new Response(JSON.stringify({ CleanResult: true }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await cloudmersiveScanner({ apiKey: "k", fetchImpl: spy })(jpeg(), "a.jpg", "image/jpeg")).toEqual({ ok: true, method: "cloudmersive" });
    expect(sent!.url).toBe("https://api.cloudmersive.com/virus/scan/file/advanced");
    expect(sent!.headers).toMatchObject({ Apikey: "k", allowExecutables: "false", allowMacros: "false", allowScripts: "true" });
    expect(await cloudmersiveScanner({ apiKey: "k", fetchImpl: answer({ CleanResult: false, FoundViruses: [{ VirusName: "Eicar-Test" }] }) })(jpeg(), "a.jpg", "image/jpeg")).toMatchObject({ ok: false, detail: "virus:Eicar-Test" });
    expect(await cloudmersiveScanner({ apiKey: "k", fetchImpl: answer({ CleanResult: false, ContainsMacros: true }) })(jpeg(), "a.jpg", "image/jpeg")).toMatchObject({ ok: false, detail: "cloudmersive:macros" });
  });
  it("refuses the upload when the scan can't be done", async () => {
    expect(await cloudmersiveScanner({ apiKey: "k", fetchImpl: answer({}, 500) })(jpeg(), "a.jpg", "image/jpeg")).toMatchObject({ ok: false, detail: "cloudmersive:http-500" });
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await cloudmersiveScanner({ apiKey: "k", fetchImpl: down })(jpeg(), "a.jpg", "image/jpeg")).toMatchObject({ ok: false, reason: expect.stringMatching(/try again/) });
  });
  it("runs the built-in checks first, so obvious problems never leave our server", async () => {
    let called = false;
    const external = async () => {
      called = true;
      return { ok: true as const, method: "cloudmersive" as const };
    };
    expect(await createUploadScanner(external)(docx("word/vbaProject.bin"), "a.docx", DOCX_TYPE)).toMatchObject({ ok: false });
    expect(called).toBe(false);
    expect(await createUploadScanner(external)(jpeg(), "a.jpg", "image/jpeg")).toEqual({ ok: true, method: "cloudmersive" });
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("refused uploads", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const users: string[] = [];
  let dir = "";
  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
    dir = await mkdtemp(join(tmpdir(), "scan-test-"));
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  it("logs a refused upload and stores nothing; a clean one records how it was checked", async () => {
    const mailer: EmailDriver = { name: "console", send: async () => {} };
    const u = await db.user.create({ data: { id: randomUUID(), email: `scan-${randomUUID()}@test.dev`, name: "Scan" } });
    users.push(u.id);
    const f = await createFirmService({ db, mailer, siteUrl: "https://casepingo.test" }).createFirm(u.id, "Firm Scan");
    if (!f.ok) throw new Error();
    const docs = createFirmDocumentService({ db, store: createLocalFileStore(dir) });
    expect(await docs.upload(u.id, { data: docx("word/vbaProject.bin"), name: "letter.docx" })).toMatchObject({ ok: false, field: "file", error: expect.stringMatching(/macros/) });
    expect(await db.firmDocument.count({ where: { firmId: f.firm.id } })).toBe(0);
    expect(await readdir(dir)).toEqual([]);
    expect(await db.auditLog.findFirst({ where: { firmId: f.firm.id, action: "document.blocked" } })).toMatchObject({ actorUserId: u.id, metadata: { name: "letter.docx", why: "docx:active-content" } });
    const ok = await docs.upload(u.id, { data: pdf("1 0 obj << >> endobj"), name: "notice.pdf" });
    if (!ok.ok) throw new Error(ok.error);
    expect(await db.firmDocument.findUniqueOrThrow({ where: { id: ok.id } })).toMatchObject({ scannedWith: "basic" });
  });
});
