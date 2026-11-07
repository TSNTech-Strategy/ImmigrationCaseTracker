/** Dashboard reports as CSV (Phase 5), and open document requests on the dashboard. */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { parseCsv } from "@/lib/csv";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmDocumentService } from "../documents";
import { createDocumentRequestService } from "../requests";
import { createFirmDashboardService } from "../dashboard";
import { createFirmReportService, isReportKey } from "../reports";

const url = process.env.TEST_DATABASE_URL;

describe("report keys", () => {
  it("knows its reports", () => {
    expect(isReportKey("status")).toBe(true);
    expect(isReportKey("all")).toBe(true);
    expect(isReportKey("../etc")).toBe(false);
  });
});

describe.skipIf(!url)("dashboard reports", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2027-12-20T15:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const users: string[] = [];

  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("exports every row with the dashboard's filters, and counts open requests", async () => {
    const mk = async (label: string) => {
      const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev`, name: label } });
      users.push(u.id);
      return u.id;
    };
    const owner = await mk("owner");
    const staff = await mk("staff");
    const outsider = await mk("outsider");
    const f = await firms.createFirm(owner, "Firm Reports");
    if (!f.ok) throw new Error();
    await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    await db.firm.update({ where: { id: f.firm.id }, data: { plan: "FIRM", caseLimit: 300 } });
    // Ten clients from ten countries: more than the dashboard's top 8.
    const countries = ["MX", "IN", "CN", "PH", "VN", "BR", "NG", "UA", "GT", "SV"];
    for (const [i, cc] of countries.entries()) {
      const c = await svc.createClient(owner, { firstName: `Client${i}`, lastName: "Test", countryOfBirth: cc, email: `c${i}@example.com` });
      if (!c.ok) throw new Error();
      const r = await svc.addCase(owner, { clientId: c.clientId, receipt: `IOE09124${String(i).padStart(5, "0")}`, basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28", assigneeId: i < 3 ? staff : owner });
      if (!r.ok) throw new Error(r.error);
      if (i === 0) {
        const docs = createFirmDocumentService({ db, store: null });
        const reqs = createDocumentRequestService({ db, mailer, siteUrl: "https://casepingo.test", docs, now });
        const q = await reqs.create(owner, { clientId: c.clientId, caseId: r.caseId, title: "=Passport please", dueOn: "2027-12-18", items: [{ label: "Passport" }, { label: "Photo", required: false }] });
        if (!q.ok) throw new Error();
      }
    }

    const dash = createFirmDashboardService({ db, now });
    const d = (await dash.getDashboard(owner))!;
    expect(d.byCountry).toHaveLength(8); // top 7 + "Other"
    expect(d.kpis).toMatchObject({ cases: 10, openRequests: 1, overdueRequests: 1, toReview: 0 });
    expect(d.requests[0]).toMatchObject({ title: "=Passport please", required: 1, accepted: 0, waiting: 2, daysLeft: -2 });
    // Scoped to staff's cases, the request (on client 0's case) still shows; on another assignee it wouldn't.
    expect((await dash.getDashboard(owner, { assignee: staff }))!.kpis).toMatchObject({ cases: 3, openRequests: 1 });
    expect((await dash.getDashboard(owner, { assignee: owner }))!.kpis).toMatchObject({ cases: 7, openRequests: 0 });

    const reports = createFirmReportService({ db, now });
    const country = await reports.exportReport(staff, "country", {});
    if (!country.ok) throw new Error(country.error);
    expect(country.filename).toBe("casepingo-report-country-2027-12-20.csv");
    const rows = parseCsv(country.csv.replace(/^﻿/, ""));
    expect(rows[0]).toEqual(["Item", "Clients"]);
    expect(rows.slice(1).filter((r) => r.length > 1)).toHaveLength(10); // every country, no "Other"

    const assignee = await reports.exportReport(owner, "assignee", { assignee: staff });
    if (!assignee.ok) throw new Error();
    expect(parseCsv(assignee.csv.replace(/^﻿/, "")).filter((r) => r.length > 1)).toEqual([["Item", "Cases"], ["staff", "3"]]);

    const req = await reports.exportReport(owner, "requests", {});
    if (!req.ok) throw new Error();
    expect(req.csv).toContain("'=Passport please"); // formulas neutralized
    expect(req.csv).not.toMatch(/IOE09124\d{5}/); // receipts masked

    const all = await reports.exportReport(owner, "all", {});
    if (!all.ok) throw new Error();
    expect(all.csv).toContain("Status overview,");
    expect(all.csv).toContain("Summary,Open document requests,1");

    expect(await reports.exportReport(owner, "nope", {})).toMatchObject({ ok: false });
    expect(await reports.exportReport(outsider, "status", {})).toMatchObject({ ok: false });
    const logged = await db.auditLog.findMany({ where: { firmId: f.firm.id, action: "report.exported" }, select: { metadata: true } });
    expect(logged).toHaveLength(4);
    expect(logged.map((l) => (l.metadata as { report: string }).report).sort()).toEqual(["all", "assignee", "country", "requests"]);
  });
});
