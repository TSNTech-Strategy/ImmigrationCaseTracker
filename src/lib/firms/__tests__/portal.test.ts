/** Client portal (Phase 4): firm logo, open requests and shared files on the status page, logo in emails. */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { withFirmLogo } from "@/lib/email/templates";
import { createLocalFileStore } from "@/lib/storage/file-store";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmDocumentService } from "../documents";
import { createDocumentRequestService } from "../requests";
import { createFirmUpdateService } from "../updates";
import { createFirmBrandingService, logoPath, logoType } from "../branding";

const url = process.env.TEST_DATABASE_URL;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 0x41)]);

describe("logo checks and branded emails", () => {
  it("accepts PNG, JPEG and WebP logos only", () => {
    expect(logoType(PNG)).toBe("image/png");
    expect(logoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(logoType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))).toBe("image/webp");
    expect(logoType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(logoType(PDF)).toBeNull();
    expect(logoPath({ id: "f1", logoKey: null, logoVersion: 3 })).toBeNull();
    expect(logoPath({ id: "f1", logoKey: "k", logoVersion: 3 })).toBe("/brand/f1/logo?v=3");
  });
  it("adds an HTML version with the logo, with the same words escaped", () => {
    const m: EmailMessage = { to: "a@b.c", subject: "s", body: "Hello <Ana>,\n\nUpload here: https://casepingo.test/upload/x.y\n\n— Rivera & Co" };
    expect(withFirmLogo(m, null, "Rivera")).toEqual(m);
    const html = withFirmLogo(m, "https://casepingo.test/brand/f1/logo?v=1", "Rivera & Co").html!;
    expect(html).toContain('<img src="https://casepingo.test/brand/f1/logo?v=1" alt="Rivera &amp; Co"');
    expect(html).toContain("Hello &lt;Ana&gt;,");
    expect(html).toContain('<a href="https://casepingo.test/upload/x.y"');
    expect(html).not.toContain("<Ana>");
  });
});

describe.skipIf(!url)("client portal", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-12-20T15:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const site = "https://casepingo.test";
  const firms = createFirmService({ db, mailer, siteUrl: site, now });
  const users: string[] = [];
  let dir = "";

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
    dir = await mkdtemp(join(tmpdir(), "portal-test-"));
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  it("shows open requests and shared files on the client's page, with the firm's logo", async () => {
    const store = createLocalFileStore(dir);
    const brand = createFirmBrandingService({ db, store });
    const docs = createFirmDocumentService({ db, store });
    const reqs = createDocumentRequestService({ db, mailer, siteUrl: site, docs, now });
    const updates = createFirmUpdateService({ db, mailer, siteUrl: site, now });
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const staff = await mk("staff");
    const f = await firms.createFirm(owner, "Firm Portal");
    if (!f.ok) throw new Error();
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });

    // Logo: managers only, images only, replaced cleanly.
    expect(await brand.setLogo(staff, { data: PNG, name: "logo.png" })).toMatchObject({ ok: false });
    expect(await brand.setLogo(owner, { data: PDF, name: "logo.png" })).toMatchObject({ ok: false, field: "logo" });
    expect(await brand.setLogo(owner, { data: Buffer.alloc(600 * 1024, 0x89), name: "big.png" })).toMatchObject({ ok: false, field: "logo" });
    expect(await brand.setLogo(owner, { data: PNG, name: "logo.png" })).toEqual({ ok: true });
    const logo = await brand.getLogo(f.firm.id);
    expect(logo).toMatchObject({ contentType: "image/png", version: 1 });
    expect(logo!.data.equals(PNG)).toBe(true);

    const ana = await svc.createClient(owner, { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", locale: "es" });
    const ben = await svc.createClient(owner, { displayName: "Ben Cho" });
    if (!ana.ok || !ben.ok) throw new Error();
    await updates.setPortal(owner, ana.clientId, "on");
    const portal = updates.portalUrl(await db.client.findUniqueOrThrow({ where: { id: ana.clientId } }));
    const token = portal!.split("/status/")[1]!;

    // A request (emailed with the logo), a shared file, an internal file, and another client's file.
    const r = await reqs.create(owner, { clientId: ana.clientId, title: "Documentos", dueOn: "2027-12-30", items: [{ label: "Passport" }, { label: "Photos", required: false }] });
    if (!r.ok) throw new Error();
    await reqs.send(owner, r.id);
    expect(sent.at(-1)!.html).toContain(`${site}/brand/${f.firm.id}/logo?v=1`);
    const shared = await docs.upload(owner, { data: PDF, name: "I-797 copy.pdf", clientId: ana.clientId, visibility: "CLIENT" });
    const internal = await docs.upload(owner, { data: PDF, name: "notes.pdf", clientId: ana.clientId });
    const other = await docs.upload(owner, { data: PDF, name: "ben.pdf", clientId: ben.clientId, visibility: "CLIENT" });
    if (!shared.ok || !internal.ok || !other.ok) throw new Error();

    const view = (await updates.portalView(token))!;
    expect(view.firm.logo).toBe(`/brand/${f.firm.id}/logo?v=1`);
    expect(view.requests).toEqual([expect.objectContaining({ title: "Documentos", required: 1, done: 0, waiting: 2 })]);
    expect((await reqs.publicView(view.requests[0]!.uploadPath.split("/upload/")[1]!))!.title).toBe("Documentos");
    expect(view.documents.map((d) => d.name)).toEqual(["I-797 copy.pdf"]);

    // Downloads: only this client's shared files, and it's in the activity log.
    const client = (await updates.portalClient(token))!;
    const dl = await docs.downloadShared(client.firmId, client.id, shared.id);
    expect(dl).toMatchObject({ ok: true, name: "I-797 copy.pdf" });
    expect(await docs.downloadShared(client.firmId, client.id, internal.id)).toMatchObject({ ok: false });
    expect(await docs.downloadShared(client.firmId, client.id, other.id)).toMatchObject({ ok: false });
    expect(await db.auditLog.count({ where: { firmId: f.firm.id, action: "document.client_downloaded" } })).toBe(1);

    // A finished request leaves the page; a turned-off link shows nothing.
    await reqs.setCanceled(owner, r.id, true);
    expect((await updates.portalView(token))!.requests).toEqual([]);
    await updates.setPortal(owner, ana.clientId, "off");
    expect(await updates.portalClient(token)).toBeNull();

    // Removing the logo.
    expect(await brand.removeLogo(owner)).toEqual({ ok: true });
    expect(await brand.getLogo(f.firm.id)).toBeNull();
    const acts = (await db.auditLog.findMany({ where: { firmId: f.firm.id, action: { startsWith: "firm.logo" } }, select: { action: true }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(acts).toEqual(["firm.logo_updated", "firm.logo_removed"]);
  });
});
