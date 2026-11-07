/** Document requests: links, client uploads, review, completion, reminders (TEST_DATABASE_URL for the DB part). */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { createLocalFileStore } from "@/lib/storage/file-store";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmDocumentService } from "../documents";
import { createDocumentRequestService, itemsFromChecklist, readRequestToken, requestToken } from "../requests";

const url = process.env.TEST_DATABASE_URL;
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 0x41)]);
const DAY = 86_400_000;

describe("request links and checklists", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  it("signs links so they can't be guessed or edited", () => {
    const t = requestToken("cmrequest0001abcd", 2);
    expect(readRequestToken(t)).toEqual({ id: "cmrequest0001abcd", version: 2 });
    const [, mac] = t.split(".");
    expect(readRequestToken(`${Buffer.from("cmrequest0001abcd.3").toString("base64url")}.${mac}`)).toBeNull();
    expect(readRequestToken("garbage")).toBeNull();
  });
  it("turns a form's checklist into bilingual request items", () => {
    const items = itemsFromChecklist("I-485");
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((i) => i.label && i.labelEs)).toBe(true);
    expect(itemsFromChecklist("X-999")).toEqual([]);
  });
});

describe.skipIf(!url)("document requests", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-12-15T15:00:00Z");
  const now = () => clock;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  let dir = "";

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
    dir = await mkdtemp(join(tmpdir(), "req-test-"));
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  it("asks a client for documents, takes their uploads, reviews them and completes", async () => {
    const docs = createFirmDocumentService({ db, store: createLocalFileStore(dir) });
    const reqs = createDocumentRequestService({ db, mailer, siteUrl: "https://casepingo.test", docs, now });
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const paralegal = await mk("paralegal");
    const outsider = await mk("outsider");
    const f = await firms.createFirm(owner, "Firm Requests");
    const g = await firms.createFirm(outsider, "Firm Else");
    if (!f.ok || !g.ok) throw new Error();
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: paralegal, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    const ana = await svc.createClient(owner, { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", locale: "es" });
    const ben = await svc.createClient(owner, { displayName: "Ben Cho" });
    if (!ana.ok || !ben.ok) throw new Error();
    const added = await svc.addCase(owner, { clientId: ana.clientId, receipt: "IOE0912395001", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28", assigneeId: paralegal });
    if (!added.ok) throw new Error(added.error);

    expect(await reqs.create(outsider, { clientId: ana.clientId, title: "Docs", items: [{ label: "x" }] })).toMatchObject({ ok: false, field: "clientId" });
    expect(await reqs.create(owner, { clientId: ben.clientId, caseId: added.caseId, title: "Docs", items: [{ label: "x" }] })).toMatchObject({ ok: false, field: "caseId" });
    expect(await reqs.create(owner, { clientId: ana.clientId, title: "Docs", items: [{ label: "  " }] })).toMatchObject({ ok: false, field: "items" });
    const noEmail = await reqs.create(owner, { clientId: ben.clientId, title: "For Ben", items: [{ label: "Passport" }] });
    if (!noEmail.ok) throw new Error();
    expect(await reqs.send(owner, noEmail.id)).toMatchObject({ ok: false });

    const due = new Date(clock.getTime() + 5 * DAY).toISOString().slice(0, 10);
    const r = await reqs.create(owner, {
      clientId: ana.clientId,
      caseId: added.caseId,
      title: "Documents for your I-485",
      dueOn: due,
      items: [{ label: "Passport", labelEs: "Pasaporte" }, { label: "Birth certificate", labelEs: "Acta de nacimiento" }, { label: "Old visas", required: false }],
    });
    if (!r.ok) throw new Error(r.error);
    expect(await reqs.send(owner, r.id)).toEqual({ ok: true });
    expect(sent.at(-1)).toMatchObject({ to: "ana@example.com", subject: "Firm Requests le pide documentos: Documents for your I-485", fromName: "Firm Requests via CasePingo" });
    expect(sent.at(-1)!.body).toContain("Pasaporte");
    const link = (await reqs.get(owner, r.id))!.link;
    const token = link.split("/upload/")[1]!;

    // The client's page, and an upload for the passport.
    const view = (await reqs.publicView(token))!;
    expect(view).toMatchObject({ client: { name: "Ana", locale: "es" }, title: "Documents for your I-485", progress: { required: 2, requiredAccepted: 0 } });
    const [passport, birth, visas] = view.items;
    expect(await reqs.uploadFromClient(token, passport!.id, { data: Buffer.from("not a pdf"), name: "p.pdf" })).toMatchObject({ ok: false });
    expect(await reqs.uploadFromClient(token, passport!.id, { data: PDF, name: "pasaporte.pdf" })).toEqual({ ok: true, name: "pasaporte.pdf" });
    const doc = await db.firmDocument.findFirstOrThrow({ where: { requestItemId: passport!.id } });
    expect(doc).toMatchObject({ source: "CLIENT", visibility: "CLIENT", clientId: ana.clientId, caseId: added.caseId, uploadedById: null });
    const inbox = await db.firmUpdate.findFirstOrThrow({ where: { requestId: r.id } });
    expect(inbox).toMatchObject({ kind: "DOCUMENT", assignedToId: paralegal, state: "OPEN" });
    expect(await db.auditLog.findFirst({ where: { firmId: f.firm.id, action: "request.client_uploaded" } })).toMatchObject({ actorUserId: null });

    // Ask again needs a reason and emails the client; they upload again.
    expect(await reqs.review(paralegal, passport!.id, "reject")).toMatchObject({ ok: false, field: "reason" });
    expect(await reqs.review(paralegal, passport!.id, "reject", "La foto está borrosa")).toEqual({ ok: true, completed: false });
    expect(sent.at(-1)).toMatchObject({ subject: "Firm Requests necesita que vuelva a subir un documento" });
    expect((await reqs.publicView(token))!.items[0]).toMatchObject({ status: "REJECTED", rejectReason: "La foto está borrosa" });
    await reqs.uploadFromClient(token, passport!.id, { data: PDF, name: "pasaporte2.pdf" });
    expect(await reqs.review(outsider, passport!.id, "accept")).toMatchObject({ ok: false });
    expect(await reqs.review(paralegal, passport!.id, "accept")).toEqual({ ok: true, completed: false });

    // Reminders: 2 days before the due date, then the day after it; never more than two.
    expect((await reqs.runReminders()).sent).toBe(0);
    clock = new Date(clock.getTime() + 3 * DAY);
    expect((await reqs.runReminders()).sent).toBe(1);
    expect(sent.at(-1)!.subject).toBe("Recordatorio de Firm Requests: documentos pendientes");
    expect(sent.at(-1)!.body).toContain("Acta de nacimiento");
    expect(sent.at(-1)!.body).not.toContain("Pasaporte"); // already accepted
    expect((await reqs.runReminders()).sent).toBe(0);
    clock = new Date(clock.getTime() + 3 * DAY);
    expect((await reqs.runReminders()).sent).toBe(1);
    clock = new Date(clock.getTime() + 3 * DAY);
    expect((await reqs.runReminders()).sent).toBe(0);

    // The last required document completes the request (the optional one doesn't matter).
    await reqs.uploadFromClient(token, birth!.id, { data: PDF, name: "acta.pdf" });
    expect(await reqs.review(owner, birth!.id, "accept")).toEqual({ ok: true, completed: true });
    expect(await db.documentRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "COMPLETED" });
    expect(await db.firmUpdate.count({ where: { requestId: r.id, state: { not: "DONE" } } })).toBe(0);
    expect(await reqs.uploadFromClient(token, visas!.id, { data: PDF, name: "visa.pdf" })).toMatchObject({ ok: false });

    // New link and cancel make old links stop working.
    const open2 = await reqs.create(owner, { clientId: ana.clientId, title: "More", items: [{ label: "Pay stubs" }] });
    if (!open2.ok) throw new Error();
    const t1 = (await reqs.get(owner, open2.id))!.link.split("/upload/")[1]!;
    await reqs.newLink(owner, open2.id);
    expect(await reqs.publicView(t1)).toBeNull();
    const t2 = (await reqs.get(owner, open2.id))!.link.split("/upload/")[1]!;
    expect(await reqs.publicView(t2)).not.toBeNull();
    await reqs.setCanceled(owner, open2.id, true);
    expect(await reqs.publicView(t2)).toBeNull();
    expect((await reqs.list(owner, { status: "OPEN" }))!.requests.map((x) => x.title)).toEqual(["For Ben"]);
  });
});
