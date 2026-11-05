/** Firm clients and cases against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { findDueCaseIds } from "@/lib/jobs/scheduler";
import { notifyStatusChange } from "@/lib/jobs/notifications";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm clients and cases", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-04-01T12:00:00Z");
  const now = () => clock;
  const calls: string[] = [];
  let respond: ((r: string) => ReturnType<typeof mockFetchCaseStatus>) | null = null;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => (calls.push(r), respond ? respond(r) : mockFetchCaseStatus(r)) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];

  const mkUser = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
    users.push(u.id);
    return u.id;
  };
  /** A firm with an Owner and a Staff member. */
  const mkFirm = async (name: string) => {
    const owner = await mkUser(`${name}-owner`);
    const staff = await mkUser(`${name}-staff`);
    const f = await firms.createFirm(owner, `Firm ${name}`);
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    return { firmId: f.firm.id, owner, staff };
  };
  const mkClient = async (userId: string, name = "Maria Lopez") => {
    const r = await svc.createClient(userId, { displayName: name, email: "maria@example.com", phone: "+1 555 0100", externalRef: "M-1" });
    if (!r.ok) throw new Error(r.error);
    return r.clientId;
  };
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 signed 2027-03-01" };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  beforeEach(() => {
    calls.length = 0;
    sent.length = 0;
    respond = null;
    clock = new Date(clock.getTime() + 3600_000);
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("manages clients inside one firm only, and keeps contact details out of the audit log", async () => {
    const a = await mkFirm("A");
    const b = await mkFirm("B");
    const outsider = await mkUser("outsider");
    expect(await svc.createClient(a.staff, { displayName: " " })).toMatchObject({ ok: false, field: "displayName" });
    expect(await svc.createClient(a.staff, { displayName: "X Y", email: "nope" })).toMatchObject({ ok: false, field: "email" });
    const clientId = await mkClient(a.staff);

    expect((await svc.listClients(a.owner))!.clients.map((c) => c.id)).toEqual([clientId]);
    expect((await svc.listClients(b.owner))!.clients).toEqual([]);
    expect(await svc.listClients(outsider)).toBeNull();
    expect(await svc.getClient(b.owner, clientId)).toBeNull();
    expect(await svc.updateClient(b.owner, clientId, { displayName: "Hijack" })).toMatchObject({ ok: false });
    expect(await svc.setClientArchived(b.owner, clientId, true)).toMatchObject({ ok: false });

    expect(await svc.updateClient(a.staff, clientId, { displayName: "Maria L. Lopez", email: "maria@example.com", phone: "+1 555 0100", externalRef: "M-1" })).toEqual({ ok: true });
    expect(await svc.setClientArchived(a.staff, clientId, true)).toMatchObject({ ok: false, error: expect.stringContaining("Owner or Admin") });
    expect(await svc.setClientArchived(a.owner, clientId, true)).toEqual({ ok: true });
    expect((await svc.listClients(a.owner))!.clients).toEqual([]);
    expect((await svc.listClients(a.owner, { archived: true }))!.clients).toHaveLength(1);

    const logs = await db.auditLog.findMany({ where: { firmId: a.firmId, targetId: clientId } });
    expect(logs.map((l) => l.action).sort()).toEqual(["client.archived", "client.created", "client.updated"]);
    expect(JSON.stringify(logs)).not.toMatch(/maria@example|555 0100|Lopez/);
    expect(logs.find((l) => l.action === "client.updated")!.metadata).toEqual({ fields: ["displayName"] });
  });

  it("adds a firm case with a G-28 attestation, checks it once, and blocks duplicates per firm", async () => {
    const a = await mkFirm("A2");
    const b = await mkFirm("B2");
    const clientA = await mkClient(a.staff);
    const clientB = await mkClient(b.owner);

    expect(await svc.addCase(a.staff, { clientId: clientA, receipt: "EAC9999103402", ...g28, evidenceRef: " " })).toMatchObject({ ok: false, field: "evidenceRef" });
    expect(await svc.addCase(a.staff, { clientId: clientB, receipt: "EAC9999103402", ...g28 })).toMatchObject({ ok: false, field: "clientId" });
    expect(await svc.addCase(a.staff, { clientId: clientA, receipt: "NOPE", ...g28 })).toMatchObject({ ok: false, field: "receipt" });
    expect(calls).toEqual([]);

    const r = await svc.addCase(a.staff, { clientId: clientA, receipt: "eac 9999103402", nickname: "I-130", ...g28 });
    if (!r.ok) throw new Error(r.error);
    expect(r.check.status).toBe("updated");
    expect(calls).toEqual(["EAC9999103402"]);
    const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId }, include: { consents: true } });
    expect(c).toMatchObject({ firmId: a.firmId, ownerUserId: null, clientId: clientA, addedById: a.staff, receiptMasked: "EAC*******402" });
    expect(c.consents).toHaveLength(1);
    expect(c.consents[0]).toMatchObject({ basis: "LEGAL_REPRESENTATIVE", source: "FIRM_ATTESTATION", evidenceRef: "G-28 signed 2027-03-01", grantedById: a.staff });
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "case.created", targetId: c.id } })).toBe(1);

    expect(await svc.addCase(a.owner, { clientId: clientA, receipt: "EAC9999103402", ...g28 })).toMatchObject({ ok: false, field: "receipt" });
    // Another firm may track the same receipt for its own client.
    expect(await svc.addCase(b.owner, { clientId: clientB, receipt: "EAC9999103402", ...g28 })).toMatchObject({ ok: true });

    await svc.setClientArchived(a.owner, clientA, true);
    expect(await svc.addCase(a.owner, { clientId: clientA, receipt: "EAC9999103403", ...g28 })).toMatchObject({ ok: false, field: "clientId" });
  });

  it("stops new cases at the firm's limit and after the trial ends", async () => {
    const a = await mkFirm("A3");
    const client = await mkClient(a.owner);
    await db.firm.update({ where: { id: a.firmId }, data: { caseLimit: 1 } });
    expect(await svc.addCase(a.owner, { clientId: client, receipt: "EAC9999103402", ...g28 })).toMatchObject({ ok: true });
    expect(await svc.addCase(a.owner, { clientId: client, receipt: "EAC9999103403", ...g28 })).toMatchObject({ ok: false, error: expect.stringContaining("up to 1") });
    await db.firm.update({ where: { id: a.firmId }, data: { caseLimit: 10, trialEndsAt: new Date(clock.getTime() - 1000) } });
    expect(await svc.addCase(a.owner, { clientId: client, receipt: "EAC9999103403", ...g28 })).toMatchObject({ ok: false, error: expect.stringContaining("trial has ended") });
  });

  it("never lets another firm, an ex-member or an outsider see or touch a firm case", async () => {
    const a = await mkFirm("A4");
    const b = await mkFirm("B4");
    const outsider = await mkUser("out4");
    const r = await svc.addCase(a.staff, { clientId: await mkClient(a.staff), receipt: "EAC9999103402", ...g28 });
    if (!r.ok) throw new Error();
    clock = new Date(clock.getTime() + 3600_000);

    for (const who of [b.owner, b.staff, outsider]) {
      expect(await svc.getCase(who, r.caseId)).toBeNull();
      expect((await svc.refreshCase(who, r.caseId)).status).toBe("not_found");
      expect(await svc.withdrawConsent(who, r.caseId)).toMatchObject({ ok: false });
      expect(await svc.recordConsent(who, r.caseId, "LEGAL_REPRESENTATIVE", "G-28")).toMatchObject({ ok: false });
      expect(await svc.removeCase(who, r.caseId)).toMatchObject({ ok: false });
    }
    expect((await svc.listCases(b.owner))!.cases).toEqual([]);
    // Individual case lists never include firm cases.
    expect(await cases.listCases(a.staff)).toEqual([]);

    const m = await db.firmMembership.findFirstOrThrow({ where: { firmId: a.firmId, userId: a.staff } });
    expect(await firms.removeMember(a.owner, m.id)).toMatchObject({ ok: true });
    expect(await svc.getCase(a.staff, r.caseId)).toBeNull();
    expect(await db.trackedCase.count({ where: { id: r.caseId } })).toBe(1);
  });

  it("refreshes with the shared cooldown; withdrawn consent stops all checks until recorded again", async () => {
    const a = await mkFirm("A5");
    const r = await svc.addCase(a.staff, { clientId: await mkClient(a.staff), receipt: "EAC9999103402", ...g28 });
    if (!r.ok) throw new Error();
    expect((await svc.refreshCase(a.owner, r.caseId)).status).toBe("cooldown");
    clock = new Date(clock.getTime() + 11 * 60_000);
    expect((await svc.refreshCase(a.owner, r.caseId)).status).toBe("updated");

    expect(await svc.withdrawConsent(a.staff, r.caseId)).toEqual({ ok: true });
    expect(await svc.withdrawConsent(a.staff, r.caseId)).toMatchObject({ ok: false });
    clock = new Date(clock.getTime() + 13 * 3600_000);
    expect((await svc.refreshCase(a.owner, r.caseId)).status).toBe("no_consent");
    expect(await findDueCaseIds(db, clock)).not.toContain(r.caseId);
    expect((await svc.listCases(a.owner))!.cases[0].hasConsent).toBe(false);

    expect(await svc.recordConsent(a.owner, r.caseId, "AUTHORIZED_BY_APPLICANT", "x")).toMatchObject({ ok: false, field: "evidenceRef" });
    expect(await svc.recordConsent(a.owner, r.caseId, "AUTHORIZED_BY_APPLICANT", "Engagement letter 2027-04-01")).toEqual({ ok: true });
    expect(await findDueCaseIds(db, clock)).toContain(r.caseId);
    const consents = await db.caseConsent.findMany({ where: { caseId: r.caseId }, orderBy: { capturedAt: "asc" } });
    expect(consents.map((x) => [x.basis, Boolean(x.withdrawnAt)])).toEqual([["LEGAL_REPRESENTATIVE", true], ["AUTHORIZED_BY_APPLICANT", false]]);
    expect(consents[0].withdrawnById).toBe(a.staff);
  });

  it("lets only an Owner or Admin remove a firm case", async () => {
    const a = await mkFirm("A6");
    const r = await svc.addCase(a.staff, { clientId: await mkClient(a.staff), receipt: "EAC9999103402", ...g28 });
    if (!r.ok) throw new Error();
    expect(await svc.removeCase(a.staff, r.caseId)).toMatchObject({ ok: false, error: expect.stringContaining("Owner or Admin") });
    expect(await svc.removeCase(a.owner, r.caseId)).toEqual({ ok: true });
    expect(await db.trackedCase.count({ where: { id: r.caseId } })).toBe(0);
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "case.removed", targetId: r.caseId } })).toBe(1);
  });

  it("emails the member who added a firm case, or the Owners once they've left", async () => {
    const a = await mkFirm("A7");
    const r = await svc.addCase(a.staff, { clientId: await mkClient(a.staff), receipt: "EAC9999103402", ...g28 });
    if (!r.ok) throw new Error();
    const moved = async (title: string) => {
      respond = async (rc) => ({
        httpStatus: 200,
        attempts: 1,
        durationMs: 1,
        snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: title } }, rc),
      });
      const c = await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId } });
      const res = await cases.runCheck(c, "SCHEDULED");
      if (res.status !== "updated" || !res.eventId) throw new Error("no change");
      return res.eventId;
    };

    const e1 = await moved("Case Was Approved");
    expect(await notifyStatusChange(db, mailer, e1, "https://casepingo.test")).toEqual({ sent: 1, skipped: 0, failed: 0 });
    const staffEmail = (await db.user.findUniqueOrThrow({ where: { id: a.staff } })).email;
    expect(sent[0].to).toBe(staffEmail);
    expect(sent[0].body).toContain(`https://casepingo.test/firm/cases/${r.caseId}`);
    expect(sent[0].body).not.toContain("9999103402");

    const m = await db.firmMembership.findFirstOrThrow({ where: { firmId: a.firmId, userId: a.staff } });
    await firms.removeMember(a.owner, m.id);
    const e2 = await moved("Card Was Mailed To Me");
    await notifyStatusChange(db, mailer, e2, "https://casepingo.test");
    expect(sent.at(-1)!.to).toBe((await db.user.findUniqueOrThrow({ where: { id: a.owner } })).email);
  });

  it("doesn't schedule checks for a suspended firm's cases", async () => {
    const a = await mkFirm("A8");
    const r = await svc.addCase(a.owner, { clientId: await mkClient(a.owner), receipt: "EAC9999103402", ...g28 });
    if (!r.ok) throw new Error();
    clock = new Date(clock.getTime() + 13 * 3600_000);
    expect(await findDueCaseIds(db, clock)).toContain(r.caseId);
    await db.firm.update({ where: { id: a.firmId }, data: { status: "SUSPENDED" } });
    expect(await findDueCaseIds(db, clock)).not.toContain(r.caseId);
  });
});
