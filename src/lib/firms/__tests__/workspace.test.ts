/** Phase 1 workspace: client profiles, case assignees, filters, export and firm settings (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import type { EmailDriver } from "@/lib/email";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmUpdateService } from "../updates";
import { caseCategory, cleanANumber, maskANumber } from "../profile";

const url = process.env.TEST_DATABASE_URL;

describe("profile helpers", () => {
  it("reads A-Numbers and form categories", () => {
    expect(cleanANumber("A123-456-789")).toBe("123456789");
    expect(cleanANumber("a 12345678")).toBe("012345678");
    expect(cleanANumber("12-34")).toBeNull();
    expect(maskANumber("6789")).toBe("A•••-••6-789");
    expect(caseCategory("I130")).toBe("family");
    expect(caseCategory("N-400")).toBe("citizenship");
    expect(caseCategory("I-765")).toBe("permits");
    expect(caseCategory(null)).toBe("other");
  });
});

describe.skipIf(!url)("firm workspace", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-09-01T15:00:00Z");
  const now = () => clock;
  let respond: ((r: string) => ReturnType<typeof mockFetchCaseStatus>) | null = null;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => (respond ? respond(r) : mockFetchCaseStatus(r)) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const desk = createFirmUpdateService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 on file" };

  const mkUser = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label.toLowerCase()}-${randomUUID()}@test.dev`, name: label } });
    users.push(u.id);
    return u.id;
  };
  const mkFirm = async (name: string) => {
    const owner = await mkUser(`${name}-owner`);
    const staff = await mkUser(`${name}-staff`);
    const f = await firms.createFirm(owner, `Firm ${name}`);
    if (!f.ok) throw new Error(f.error);
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    return { firmId: f.firm.id, owner, staff };
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("keeps a structured client profile, with the date of birth and A-Number encrypted and never logged", async () => {
    const a = await mkFirm("Profile");
    expect(await svc.createClient(a.staff, { firstName: "Ana", lastName: "" })).toMatchObject({ ok: false, field: "lastName" });
    expect(await svc.createClient(a.staff, { firstName: "Ana", lastName: "Ruiz", aNumber: "12-34" })).toMatchObject({ ok: false, field: "aNumber" });
    expect(await svc.createClient(a.staff, { firstName: "Ana", lastName: "Ruiz", countryOfBirth: "ZZ" })).toMatchObject({ ok: false, field: "countryOfBirth" });
    expect(await svc.createClient(a.staff, { firstName: "Ana", lastName: "Ruiz", dateOfBirth: "2030-01-01" })).toMatchObject({ ok: false, field: "dateOfBirth" });

    const c = await svc.createClient(a.staff, { firstName: " Ana ", lastName: "Ruiz  Gómez", dateOfBirth: "1990-04-21", countryOfBirth: "mx", citizenship: "MX", aNumber: "A123-456-789", phone: "+1 555 010 0199", locale: "es" });
    if (!c.ok) throw new Error(c.error);
    const row = await db.client.findUniqueOrThrow({ where: { id: c.clientId } });
    expect(row).toMatchObject({ displayName: "Ana Ruiz Gómez", firstName: "Ana", lastName: "Ruiz Gómez", countryOfBirth: "MX", aNumberLast4: "6789" });
    expect(row.dateOfBirthEnc).not.toContain("1990");
    expect(row.aNumberEnc).not.toContain("123456789");
    expect((await svc.getClient(a.owner, c.clientId))!.client).toMatchObject({ dateOfBirth: "1990-04-21", aNumber: "A123-456-789" });

    // A form that doesn't send the sensitive fields leaves them alone; changes are logged by name only.
    expect(await svc.updateClient(a.staff, c.clientId, { firstName: "Ana", lastName: "Ruiz Gómez", email: "ana@example.com", phone: "+1 555 010 0199", locale: "es" })).toEqual({ ok: true });
    expect((await svc.getClient(a.owner, c.clientId))!.client).toMatchObject({ aNumber: "A123-456-789", dateOfBirth: "1990-04-21", email: "ana@example.com" });
    expect(await svc.updateClient(a.staff, c.clientId, { firstName: "Ana", lastName: "Ruiz Gómez", email: "ana@example.com", phone: "+1 555 010 0199", locale: "es", aNumber: "", dateOfBirth: "1990-04-22" })).toEqual({ ok: true });
    const logs = await db.auditLog.findMany({ where: { firmId: a.firmId, action: "client.updated" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => (l.metadata as { fields: string[] }).fields)).toEqual([["email"], ["date of birth", "A-Number"]]);
    expect(JSON.stringify(logs)).not.toMatch(/1990|6789/);

    // Imports and older forms still work with a single name.
    const plain = await svc.createClient(a.staff, { displayName: "Ben Cho" });
    expect(plain).toMatchObject({ ok: true });

    const list = await svc.listClients(a.staff, { country: "MX" });
    expect(list!.clients.map((x) => [x.displayName, x.countryName])).toEqual([["Ana Ruiz Gómez", "Mexico"]]);
    expect((await svc.listClients(a.staff, { q: "cho" }))!.clients.map((x) => x.displayName)).toEqual(["Ben Cho"]);
  });

  it("assigns cases (chosen, firm default, or whoever adds it), filters by assignee and category, and routes inbox items", async () => {
    const a = await mkFirm("Assign");
    const outsider = await mkUser("outsider");
    const c = await svc.createClient(a.owner, { displayName: "Client One" });
    if (!c.ok) throw new Error();
    const add = async (by: string, receipt: string, assigneeId?: string | null) => {
      const r = await svc.addCase(by, { clientId: c.clientId, receipt, ...g28, assigneeId });
      if (!r.ok) return r;
      return { ok: true as const, assigneeId: (await db.trackedCase.findUniqueOrThrow({ where: { id: r.caseId } })).assigneeId, caseId: r.caseId };
    };
    expect(await add(a.staff, "IOE0912350001")).toMatchObject({ assigneeId: a.staff });
    expect(await add(a.staff, "IOE0912350002", outsider)).toMatchObject({ ok: false, field: "assigneeId" });
    expect(await firms.saveGeneral(a.staff, { name: "X Firm", timeZone: "America/Chicago", defaultAssigneeId: a.owner })).toMatchObject({ ok: false });
    expect(await firms.saveGeneral(a.owner, { name: "Firm Assign", timeZone: "Mars/Base", defaultAssigneeId: null })).toMatchObject({ ok: false, field: "timeZone" });
    expect(await firms.saveGeneral(a.owner, { name: "Firm Assign LLP", timeZone: "America/Chicago", defaultAssigneeId: a.owner })).toEqual({ ok: true });
    expect(await db.auditLog.findFirst({ where: { firmId: a.firmId, action: "firm.settings" } })).toMatchObject({ metadata: { fields: ["name", "time zone", "default assignee"] } });
    const second = await add(a.staff, "IOE0912350003");
    expect(second).toMatchObject({ assigneeId: a.owner }); // the firm's default
    const third = await add(a.owner, "IOE0912350004", a.staff);
    expect(third).toMatchObject({ assigneeId: a.staff });
    if (!second.ok || !third.ok) throw new Error();

    const names = async (f: Parameters<typeof svc.listCases>[1]) => (await svc.listCases(a.staff, f))!.cases.map((x) => x.receiptMasked).sort();
    expect(await names({ assignee: "me" })).toEqual(["IOE*******001", "IOE*******004"]);
    expect(await names({ assignee: a.owner })).toEqual(["IOE*******003"]);
    await db.trackedCase.update({ where: { id: third.caseId }, data: { formType: "N-400" } });
    expect(await names({ category: "citizenship" })).toEqual(["IOE*******004"]);
    expect(await names({ category: "family" })).toEqual(["IOE*******001", "IOE*******003"]); // the mock reports I-130
    expect(await names({ category: "other" })).toEqual([]);
    expect((await svc.listCases(a.staff, {}))!.cases.find((x) => x.id === third.caseId)).toMatchObject({ category: "citizenship", assignee: { id: a.staff } });

    // A change on the case lands in the assignee's inbox; reassigning moves the open item.
    clock = new Date(clock.getTime() + 3600_000);
    respond = async (rc) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: "Interview Was Scheduled", form_type: "I-130" } }, rc) });
    const res = await cases.runCheck(await db.trackedCase.findUniqueOrThrow({ where: { id: second.caseId } }), "SCHEDULED");
    if (res.status !== "updated" || !res.eventId) throw new Error("no change");
    const rec = await desk.recordStatusChange(res.eventId);
    expect(await db.firmUpdate.findUniqueOrThrow({ where: { id: rec.updateId! } })).toMatchObject({ assignedToId: a.owner });
    expect(await svc.setAssignee(a.staff, second.caseId, outsider)).toMatchObject({ ok: false });
    expect(await svc.setAssignee(a.staff, second.caseId, a.staff)).toEqual({ ok: true });
    expect(await db.firmUpdate.findUniqueOrThrow({ where: { id: rec.updateId! } })).toMatchObject({ assignedToId: a.staff });
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "case.assigned" } })).toBe(1);
  });

  it("exports every case to CSV for Owners and Admins only, with full receipts, and logs it", async () => {
    const a = await mkFirm("Export");
    const c = await svc.createClient(a.owner, { displayName: "=Danger, Client", externalRef: "M-9" });
    if (!c.ok) throw new Error();
    await svc.addCase(a.owner, { clientId: c.clientId, receipt: "IOE0912350101", ...g28 });
    expect(await svc.exportCases(a.staff)).toMatchObject({ ok: false });
    const r = await svc.exportCases(a.owner);
    if (!r.ok) throw new Error(r.error);
    expect(r.count).toBe(1);
    expect(r.csv.startsWith("﻿Client,Client reference,Receipt number")).toBe(true);
    expect(r.csv).toContain("IOE0912350101");
    expect(r.csv).toContain(`"'=Danger, Client"`); // formula-safe and quoted
    expect(await db.auditLog.findFirst({ where: { firmId: a.firmId, action: "cases.exported" } })).toMatchObject({ metadata: { rows: 1 } });
  });
});
