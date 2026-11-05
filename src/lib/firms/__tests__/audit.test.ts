/** Firm activity log against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { parseCsv } from "@/lib/csv";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import type { EmailDriver } from "@/lib/email";
import { AUDIT_PAGE_SIZE, createFirmAuditService, describeAudit } from "../audit";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm activity log", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-06-01T12:00:00Z");
  const now = () => (clock = new Date(clock.getTime() + 1000));
  const uscis: UscisPort = { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const mailer: EmailDriver = { name: "console", send: async () => {} };
  const firms = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now });
  const audit = createFirmAuditService({ db, now });
  const users: string[] = [];
  const mkUser = async (label: string) => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `${label}-${id}@test.dev`, name: label } });
    users.push(id);
    return id;
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString("base64");
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("shows readable, firm-only entries to Owners and Admins, with masked receipts and links", async () => {
    const owner = await mkUser("owner");
    const staff = await mkUser("staff");
    const f = await firms.createFirm(owner, "Audit Firm");
    if (!f.ok) throw new Error();
    const sm = await db.firmMembership.create({ data: { firmId: f.firm.id, userId: staff, role: "STAFF" } });
    const other = await mkUser("other");
    await firms.createFirm(other, "Other Firm");

    const client = await svc.createClient(staff, { displayName: "Maria Lopez", email: "maria@example.com" });
    if (!client.ok) throw new Error();
    const c = await svc.addCase(staff, { clientId: client.clientId, receipt: "EAC9999103402", nickname: "I-130", basis: "LEGAL_REPRESENTATIVE", evidenceRef: "G-28" });
    if (!c.ok) throw new Error();
    await svc.withdrawConsent(staff, c.caseId);
    await firms.changeRole(owner, sm.id, "ADMIN");

    expect(await audit.list(other)).toMatchObject({ entries: [{ action: "firm.created" }] });
    await firms.changeRole(owner, sm.id, "STAFF");
    expect(await audit.list(staff)).toBeNull();
    expect(await audit.exportCsv(staff)).toEqual({ ok: false });
    await firms.changeRole(owner, sm.id, "ADMIN");

    const r = await audit.list(staff);
    if (!r) throw new Error();
    const text = r.entries.map((e) => `${e.actor}: ${e.description}`);
    expect(text).toContain("staff: Added client Maria Lopez");
    expect(text).toContain("staff: Added case EAC*******402 (I-130): We represent this client (Form G-28 on file)");
    expect(text).toContain("staff: Withdrew consent for case EAC*******402 (I-130), so checks stopped");
    expect(text).toContain("owner: Changed staff's role from Staff to Admin");
    expect(text.at(-1)).toBe("owner: Created the firm workspace");
    expect(r.entries.find((e) => e.action === "case.created")!.href).toBe(`/firm/cases/${c.caseId}`);
    expect(JSON.stringify(r)).not.toMatch(/9999103402|maria@example|Other Firm/);
    expect(r.actors.map((a) => a.label).sort()).toEqual(["owner", "staff"]);

    // Filters
    const casesOnly = await audit.list(owner, { category: "cases" });
    expect(new Set(casesOnly!.entries.map((e) => e.action))).toEqual(new Set(["case.created", "consent.withdrawn"]));
    expect((await audit.list(owner, { actorId: owner }))!.entries.every((e) => e.actor === "owner")).toBe(true);
    expect((await audit.list(owner, { from: new Date(clock.getTime() + 60_000) }))!.entries).toEqual([]);

    // A removed case still shows, without the receipt.
    await svc.removeCase(owner, c.caseId);
    const after = await audit.list(owner, { category: "cases" });
    expect(after!.entries.find((e) => e.action === "consent.withdrawn")!.description).toBe(
      "Withdrew consent for case an item that was later removed, so checks stopped",
    );
  });

  it("pages through long logs without gaps or repeats", async () => {
    const owner = await mkUser("pager");
    const f = await firms.createFirm(owner, "Pager Firm");
    if (!f.ok) throw new Error();
    const t = clock.getTime();
    await db.auditLog.createMany({
      data: Array.from({ length: AUDIT_PAGE_SIZE + 7 }, (_, i) => ({
        firmId: f.firm.id,
        actorUserId: owner,
        action: "client.archived",
        targetType: "Client",
        targetId: `c${i}`,
        createdAt: new Date(t + Math.floor(i / 3) * 1000), // ties on purpose
      })),
    });
    const seen: string[] = [];
    let before: string | undefined;
    for (let i = 0; i < 5; i++) {
      const p = await audit.list(owner, { before });
      seen.push(...p!.entries.map((e) => e.id));
      if (!p!.nextBefore) break;
      before = p!.nextBefore;
    }
    expect(seen).toHaveLength(AUDIT_PAGE_SIZE + 8); // + firm.created
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("exports a formula-safe CSV and records the export", async () => {
    const owner = await mkUser("exporter");
    const f = await firms.createFirm(owner, "Export Firm");
    if (!f.ok) throw new Error();
    await svc.createClient(owner, { displayName: "=HYPERLINK(\"http://evil\")" });
    const r = await audit.exportCsv(owner);
    if (!r.ok) throw new Error();
    expect(r.filename).toMatch(/^casepingo-activity-\d{4}-\d{2}-\d{2}\.csv$/);
    const rows = parseCsv(r.csv);
    expect(rows[0]).toEqual(["time_utc", "actor", "actor_email", "action", "description"]);
    expect(rows).toHaveLength(3);
    expect(rows.find((x) => x[3] === "client.created")![4]).toBe('Added client =HYPERLINK("http://evil")'); // starts with "A": safe
    expect(r.csv).not.toMatch(/\n=|,=/);
    const logged = await db.auditLog.findFirstOrThrow({ where: { firmId: f.firm.id, action: "audit.exported" } });
    expect(logged.metadata).toEqual({ rows: 2, category: null });
    expect(describeAudit("audit.exported", { rows: 2 }, "")).toBe("Exported the activity log (2 entries)");
  });
});
