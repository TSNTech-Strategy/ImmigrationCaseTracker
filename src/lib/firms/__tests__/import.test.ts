/** CSV import and case filters against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { findDueCaseIds } from "@/lib/jobs/scheduler";
import { createFirmCaseService } from "../cases";
import { createFirmImportService, IMPORT_MAX_ROWS } from "../import";
import { createFirmService } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm CSV import and filters", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const clock = new Date("2027-05-01T12:00:00Z");
  const now = () => clock;
  const calls: string[] = [];
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => (calls.push(r), mockFetchCaseStatus(r)) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const imp = createFirmImportService({ db, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 on file" };

  const mkFirm = async (name: string) => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `${name.toLowerCase()}-${id}@test.dev` } });
    users.push(id);
    const f = await firms.createFirm(id, `Firm ${name}`);
    if (!f.ok) throw new Error(f.error);
    return { owner: id, firmId: f.firm.id };
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 8).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("previews without saving: matches clients, flags every problem row, never echoes full receipts", async () => {
    const a = await mkFirm("Imp1");
    const existing = await svc.createClient(a.owner, { displayName: "Maria Lopez", externalRef: "M-1" });
    if (!existing.ok) throw new Error();
    await svc.createClient(a.owner, { displayName: "Twin Name" });
    await svc.createClient(a.owner, { displayName: "twin name" });
    const archived = await svc.createClient(a.owner, { displayName: "Old Client" });
    if (!archived.ok) throw new Error();
    await svc.setClientArchived(a.owner, archived.clientId, true);
    await svc.addCase(a.owner, { clientId: existing.clientId, receipt: "IOE0000000001", ...g28 });
    calls.length = 0;

    const csv = [
      "Client Name;Matter #;Receipt Number;Label;Evidence",
      "maria lopez;;EAC9999103402;I-130;", // existing client by name
      "Someone Else;m-1;EAC9999103403;;", // existing client by ref beats name
      "New Person;;IOE0000000002;;", // new client
      "New Person;;IOE0000000003;;", // same new client, not created twice
      "Bad Receipt;;ABC123;;",
      "Dup In File;;eac9999103402;;",
      "Already Tracked;;IOE0000000001;;",
      "Twin Name;;IOE0000000004;;",
      "Old Client;;IOE0000000005;;",
      ";;IOE0000000006;;",
    ].join("\n");
    const p = await imp.preview(a.owner, csv, g28);
    if (!p.ok) throw new Error(p.error);
    const by = Object.fromEntries(p.rows.map((r) => [r.line, r]));
    expect(by[2]).toMatchObject({ clientName: "Maria Lopez", newClient: false, error: null, receiptMasked: "EAC*******402" });
    expect(by[3]).toMatchObject({ clientName: "Maria Lopez", error: null });
    expect(by[4]).toMatchObject({ newClient: true, error: null });
    expect(by[5]).toMatchObject({ newClient: false, error: null });
    expect(by[6].error).toMatch(/3 letters/);
    expect(by[7].error).toMatch(/earlier in the file/);
    expect(by[8].error).toMatch(/already tracking/);
    expect(by[9].error).toMatch(/More than one client/);
    expect(by[10].error).toMatch(/archived/);
    expect(by[11].error).toMatch(/client's name/);
    expect(p).toMatchObject({ toAdd: 4, newClients: 1, errors: 6 });
    expect(JSON.stringify(p)).not.toMatch(/9999103402|0000000002/);
    expect(await db.trackedCase.count({ where: { firmId: a.firmId } })).toBe(1);
    expect(calls).toEqual([]);
  });

  it("imports only valid rows in one go, with consent evidence and audit entries, and schedules the checks", async () => {
    const a = await mkFirm("Imp2");
    const csv = "client_name,client_ref,receipt_number,label,evidence\nAna Ruiz,R-1,EAC9999103402,I-485,Engagement letter 2027-04-01\nAna Ruiz,R-1,EAC9999103403,I-765,\nBen Cho,,NOPE,,\n";
    const r = await imp.run(a.owner, csv, { basis: "AUTHORIZED_BY_APPLICANT", evidenceRef: "Written consent on file" });
    expect(r).toEqual({ ok: true, added: 2, newClients: 1, skipped: 1 });
    expect(calls).toEqual([]); // no inline USCIS calls

    const rows = await db.trackedCase.findMany({ where: { firmId: a.firmId }, include: { consents: true, client: true }, orderBy: { nickname: "asc" } });
    expect(rows.map((c) => [c.nickname, c.client!.displayName, c.client!.externalRef])).toEqual([["I-485", "Ana Ruiz", "R-1"], ["I-765", "Ana Ruiz", "R-1"]]);
    expect(rows.map((c) => c.consents[0].evidenceRef)).toEqual(["Engagement letter 2027-04-01", "Written consent on file"]);
    expect(rows.every((c) => c.consents[0].source === "CSV_IMPORT" && c.consents[0].basis === "AUTHORIZED_BY_APPLICANT")).toBe(true);
    expect(rows.every((c) => c.receiptEncrypted && !c.receiptEncrypted.includes("9999"))).toBe(true);
    const due = await findDueCaseIds(db, clock);
    expect(rows.every((c) => due.includes(c.id))).toBe(true);
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "case.created" } })).toBe(2);
    const summary = await db.auditLog.findFirstOrThrow({ where: { firmId: a.firmId, action: "cases.imported" } });
    expect(summary.metadata).toEqual({ added: 2, newClients: 1, skipped: 1 });

    // Running the same file again adds nothing.
    expect(await imp.run(a.owner, csv, g28)).toMatchObject({ ok: false });
  });

  it("enforces the case limit, row cap, trial end, required columns and firm membership", async () => {
    const a = await mkFirm("Imp3");
    await db.firm.update({ where: { id: a.firmId }, data: { caseLimit: 1 } });
    const p = await imp.preview(a.owner, "client,receipt\nA B,EAC9999103402\nA B,EAC9999103403\n", g28);
    if (!p.ok) throw new Error();
    expect(p.rows.map((r) => r.error)).toEqual([null, expect.stringMatching(/limit of 1/)]);

    const many = "client,receipt\n" + Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `C D,IOE${String(i).padStart(10, "0")}`).join("\n");
    expect(await imp.preview(a.owner, many, g28)).toMatchObject({ ok: false, error: expect.stringMatching(/up to 200/) });
    expect(await imp.preview(a.owner, "name,label\nA,B", g28)).toMatchObject({ ok: false, error: expect.stringMatching(/receipt_number/) });
    expect(await imp.preview(a.owner, "client,receipt\nA B,EAC9999103402", { ...g28, evidenceRef: "" })).toMatchObject({
      ok: true,
      rows: [{ error: expect.stringMatching(/evidence/) }],
    });
    const outsider = randomUUID();
    await db.user.create({ data: { id: outsider, email: `out-${outsider}@test.dev` } });
    users.push(outsider);
    expect(await imp.run(outsider, "client,receipt\nA B,EAC9999103402", g28)).toMatchObject({ ok: false });

    await db.firm.update({ where: { id: a.firmId }, data: { trialEndsAt: new Date(clock.getTime() - 1) } });
    expect(await imp.preview(a.owner, "client,receipt\nA B,EAC9999103402", g28)).toMatchObject({ ok: false, error: expect.stringMatching(/trial/) });
  });

  it("filters and searches firm cases, including by full receipt number", async () => {
    const a = await mkFirm("Flt");
    const b = await mkFirm("Flt2");
    await imp.run(a.owner, "client,client_ref,receipt,label\nZoe Adams,Z-9,EAC9999103402,Spouse I-130\nYan Bo,,EAC9999103403,Work permit\n", g28);
    await imp.run(b.owner, "client,receipt,label\nZoe Adams,EAC9999103402,Other firm\n", g28);
    const list = async (f: Parameters<typeof svc.listCases>[1]) => (await svc.listCases(a.owner, f))!.cases.map((c) => c.nickname);

    expect((await list({})).sort()).toEqual(["Spouse I-130", "Work permit"]);
    expect(await list({ q: "eac 9999103402" })).toEqual(["Spouse I-130"]);
    expect(await list({ q: "zoe" })).toEqual(["Spouse I-130"]);
    expect(await list({ q: "z-9" })).toEqual(["Spouse I-130"]);
    expect(await list({ q: "403" })).toEqual(["Work permit"]);
    expect((await list({ view: "unchecked" })).length).toBe(2);
    expect(await list({ sort: "client" })).toEqual(["Work permit", "Spouse I-130"]);

    const zoe = (await svc.listCases(a.owner, { q: "zoe" }))!.cases[0];
    const full = await db.trackedCase.findUniqueOrThrow({ where: { id: zoe.id } });
    await cases.runCheck(full, "SCHEDULED");
    expect(await list({ view: "changed" })).toEqual(["Spouse I-130"]);
    expect(await list({ view: "unchecked" })).toEqual(["Work permit"]);
    await svc.withdrawConsent(a.owner, zoe.id);
    expect(await list({ view: "no_consent" })).toEqual(["Spouse I-130"]);
    await db.trackedCase.update({ where: { id: zoe.id }, data: { lastCheckOutcome: "server" } });
    expect(await list({ view: "failed" })).toEqual(["Spouse I-130"]);
    const ctx = (await svc.listCases(a.owner))!.ctx;
    expect(await svc.counts(ctx)).toMatchObject({ cases: 2, changed: 1, failed: 1, unconsented: 1, unchecked: 1 });
  });
});
