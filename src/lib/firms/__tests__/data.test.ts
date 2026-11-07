/** Legal and data (Phase 7A): export everything, workspace deletion with a grace period. */
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
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
import { createFirmDocumentService } from "../documents";
import { createFirmDataService } from "../data";

const url = process.env.TEST_DATABASE_URL;
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 0x41)]);
const DAY = 86_400_000;

describe.skipIf(!url)("legal and data", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-12-20T15:00:00Z");
  const now = () => clock;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  let dir = "";

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
    dir = await mkdtemp(join(tmpdir(), "data-test-"));
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.deletionRequest.deleteMany({ where: { requesterId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  it("exports everything readable for the Owner, and deletes the workspace after the grace period", async () => {
    const store = createLocalFileStore(dir);
    const data = createFirmDataService({ db, store, now });
    const docs = createFirmDocumentService({ db, store });
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const admin = await mk("admin");
    const f = await firms.createFirm(owner, "Firm Data");
    if (!f.ok) throw new Error();
    const firmId = f.firm.id;
    await db.firmMembership.create({ data: { firmId, userId: admin, role: "ADMIN" } });
    await db.firm.update({ where: { id: firmId }, data: { plan: "FIRM", caseLimit: 300 } });
    const c = await svc.createClient(owner, { firstName: "Ana", lastName: "Ruiz", dateOfBirth: "1990-04-02", aNumber: "A123456789" });
    if (!c.ok) throw new Error(c.error);
    const added = await svc.addCase(owner, { clientId: c.clientId, receipt: "IOE0912599001", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28" });
    if (!added.ok) throw new Error(added.error);
    const up = await docs.upload(owner, { data: PDF, name: "passport.pdf", clientId: c.clientId });
    if (!up.ok) throw new Error();

    // Export: Owner only, readable sensitive fields, no encrypted columns or storage keys.
    expect(await data.exportAll(admin)).toMatchObject({ ok: false });
    const ex = await data.exportAll(owner);
    if (!ex.ok) throw new Error(ex.error);
    const json = JSON.parse(ex.json);
    expect(json.format).toBe("casepingo-firm-export/1");
    expect(json.clients[0]).toMatchObject({ firstName: "Ana", dateOfBirth: "1990-04-02", aNumber: "123456789" });
    expect(json.cases[0]).toMatchObject({ receipt: "IOE0912599001" });
    expect(json.documents[0]).toMatchObject({ name: "passport.pdf" });
    expect(ex.json).not.toMatch(/Enc"|receiptEncrypted|storageKey/);
    expect(await db.auditLog.count({ where: { firmId, action: "firm.exported" } })).toBe(1);

    // Deletion: Owner only, exact name, no active subscription.
    expect(await data.requestDeletion(admin, "Firm Data")).toMatchObject({ ok: false });
    expect(await data.requestDeletion(owner, "firm data")).toMatchObject({ ok: false, field: "confirm" });
    await db.subscription.create({ data: { stripeSubscriptionId: `sub_${randomUUID()}`, stripeCustomerId: "cus_x", firmId, product: "FIRM", interval: "month", status: "active", currentPeriodEnd: new Date(clock.getTime() + 30 * DAY) } });
    expect(await data.requestDeletion(owner, "Firm Data")).toMatchObject({ ok: false, error: expect.stringMatching(/Cancel your plan/) });
    await db.subscription.updateMany({ where: { firmId }, data: { status: "canceled" } });
    expect(await data.requestDeletion(owner, "Firm Data")).toEqual({ ok: true });
    expect(await data.pendingDeletion(firmId)).toMatchObject({ deleteAfter: new Date(clock.getTime() + 14 * DAY) });

    // Cancel, then ask again.
    expect(await data.cancelDeletion(owner)).toEqual({ ok: true });
    expect(await data.pendingDeletion(firmId)).toBeNull();
    expect(await data.requestDeletion(owner, "Firm Data")).toEqual({ ok: true });

    // Nothing happens during the grace period; afterwards the firm and its files are gone.
    clock = new Date(clock.getTime() + 13 * DAY);
    expect(await data.runDeletions()).toEqual({ deleted: 0 });
    clock = new Date(clock.getTime() + 2 * DAY);
    expect(await data.runDeletions()).toEqual({ deleted: 1 });
    expect(await db.firm.findUnique({ where: { id: firmId } })).toBeNull();
    expect(await db.client.count({ where: { firmId } })).toBe(0);
    expect(await db.trackedCase.count({ where: { firmId } })).toBe(0);
    const left = await readdir(dir).then((d) => (d.includes(firmId) ? readdir(join(dir, firmId)) : []));
    expect(left).toEqual([]);
    expect(await db.deletionRequest.findFirst({ where: { targetId: firmId, status: "COMPLETED" } })).not.toBeNull();
    // The people's accounts stay.
    expect(await db.user.count({ where: { id: { in: [owner, admin] } } })).toBe(2);
  });
});
