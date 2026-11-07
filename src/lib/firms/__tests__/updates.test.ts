/** The firm status desk (Updates inbox, client emails, client status page) against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { mockFetchCaseStatus } from "@/lib/uscis/mock";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { notifyStatusChange } from "@/lib/jobs/notifications";
import { createFirmCaseService } from "../cases";
import { createFirmService } from "../service";
import { createFirmUpdateService } from "../updates";
import { portalToken } from "../portal";

const url = process.env.TEST_DATABASE_URL;
const SITE = "https://casepingo.test";

describe.skipIf(!url)("firm status desk", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let clock = new Date("2027-06-01T12:00:00Z");
  const now = () => clock;
  let respond: ((r: string) => ReturnType<typeof mockFetchCaseStatus>) | null = null;
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async (r) => (respond ? respond(r) : mockFetchCaseStatus(r)) };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const svc = createFirmCaseService({ db, cases, now });
  const sent: EmailMessage[] = [];
  let failNext = false;
  const mailer: EmailDriver = {
    name: "console",
    send: async (m) => {
      if (failNext) {
        failNext = false;
        throw new Error("SMTP down");
      }
      sent.push(m);
    },
  };
  const firms = createFirmService({ db, mailer, siteUrl: SITE, now });
  const desk = createFirmUpdateService({ db, mailer, siteUrl: SITE, now });
  const users: string[] = [];

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
    return { firmId: f.firm.id, owner, staff };
  };
  const g28 = { basis: "LEGAL_REPRESENTATIVE" as const, evidenceRef: "G-28 signed 2027-05-01" };
  /** A client who agreed to Spanish email updates, with one tracked case. */
  const mkCase = async (userId: string, receipt = "EAC9999103402") => {
    const c = await svc.createClient(userId, { displayName: "María López", email: "maria@example.com", locale: "es", updatesConsent: true });
    if (!c.ok) throw new Error(c.error);
    const r = await svc.addCase(userId, { clientId: c.clientId, receipt, nickname: null, ...g28 });
    if (!r.ok) throw new Error(r.error);
    return { clientId: c.clientId, caseId: r.caseId };
  };
  /** USCIS shows a new status at the next scheduled check; returns the change's event id. */
  const moved = async (caseId: string, title: string) => {
    clock = new Date(clock.getTime() + 60_000);
    respond = async (rc) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: rc, current_case_status_text_en: title, form_type: "I-485" } }, rc) });
    const c = await db.trackedCase.findUniqueOrThrow({ where: { id: caseId } });
    const res = await cases.runCheck(c, "SCHEDULED");
    if (res.status !== "updated" || !res.eventId) throw new Error("no change");
    return res.eventId;
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  beforeEach(() => {
    sent.length = 0;
    respond = null;
    failNext = false;
    clock = new Date(clock.getTime() + 3600_000);
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("puts changes (not the first status) in Updates and emails the client per the firm's setting, once", async () => {
    const a = await mkFirm("D1");
    const { clientId, caseId } = await mkCase(a.staff);
    const first = await db.caseStatusEvent.findFirstOrThrow({ where: { caseId } });
    expect(await desk.recordStatusChange(first.id)).toEqual({ updateId: null });

    // Off: in the inbox, no client email.
    const e1 = await moved(caseId, "Case Is Being Actively Reviewed By USCIS");
    expect(await desk.recordStatusChange(e1)).toMatchObject({ clientUpdate: "NONE" });
    expect(sent).toHaveLength(0);
    expect((await desk.list(a.staff))!.counts.open).toBe(1);

    // Review first: waits for the team; Staff can't change the setting.
    expect(await desk.saveSettings(a.staff, { mode: "REVIEW" })).toMatchObject({ ok: false });
    expect(await desk.saveSettings(a.owner, { mode: "REVIEW", replyToEmail: "nope" })).toMatchObject({ ok: false, field: "replyToEmail" });
    expect(await desk.saveSettings(a.owner, { mode: "REVIEW", replyToEmail: "Team@LopezLaw.com ", contactLine: " Call  (555) 010-0200, Mon–Fri " })).toEqual({ ok: true });
    const e2 = await moved(caseId, "Interview Was Scheduled");
    // The scheduled job does it (staff alert + inbox); running it twice changes nothing.
    await notifyStatusChange(db, mailer, e2, SITE);
    await notifyStatusChange(db, mailer, e2, SITE);
    const staffAlerts = sent.length;
    const inbox = (await desk.list(a.staff))!;
    expect(inbox.counts.open).toBe(2);
    const pending = inbox.items[0];
    expect(pending).toMatchObject({ clientUpdate: "PENDING", nextStep: "Prepare for your interview", client: { id: clientId, displayName: "María López" } });
    expect(pending.preview!.subject).toBe("Actualización de su caso de Firm D1: Interview Was Scheduled");
    expect(pending.preview!.body).toContain("Próximo paso: Prepárese para su entrevista");

    expect(await desk.act(a.staff, pending.id, { type: "send" })).toMatchObject({ ok: true });
    const mail = sent.at(-1)!;
    expect(sent.length).toBe(staffAlerts + 1);
    expect(mail).toMatchObject({ to: "maria@example.com", fromName: "Firm D1 via CasePingo", replyTo: "team@lopezlaw.com" });
    expect(mail.body).toContain("Hola, María López:");
    expect(mail.body).toContain("EAC*******402");
    expect(mail.body).toContain("Call (555) 010-0200, Mon–Fri");
    expect(mail.body).not.toContain("9999103402");
    expect(mail.body).not.toContain("/status/");
    expect(await desk.act(a.staff, pending.id, { type: "send" })).toMatchObject({ ok: false });
    await desk.recordStatusChange(e2);
    expect(sent.length).toBe(staffAlerts + 1);

    // Automatic, with the status page on: sent right away, with the link.
    await desk.saveSettings(a.owner, { mode: "AUTO", replyToEmail: "team@lopezlaw.com" });
    await desk.setPortal(a.staff, clientId, "on");
    const e3 = await moved(caseId, "Case Was Approved");
    expect(await desk.recordStatusChange(e3)).toMatchObject({ clientUpdate: "SENT" });
    expect(sent.at(-1)!.body).toContain(`${SITE}/status/`);
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: "client_update.sent", actorUserId: null } })).toBe(1);

    // Agreement removed: the client isn't emailed.
    await svc.updateClient(a.staff, clientId, { displayName: "María López", email: "maria@example.com", locale: "es", updatesConsent: false });
    const before = sent.length;
    const e4 = await moved(caseId, "Card Was Mailed To Me");
    expect(await desk.recordStatusChange(e4)).toMatchObject({ clientUpdate: "NO_CLIENT" });
    expect(sent.length).toBe(before);
  });

  it("retries a failed client email, and lets the team skip one", async () => {
    const a = await mkFirm("D2");
    await desk.saveSettings(a.owner, { mode: "REVIEW" });
    const { caseId } = await mkCase(a.owner, "EAC9999103403");
    const e1 = await moved(caseId, "Request for Additional Evidence Was Sent");
    const { updateId } = await desk.recordStatusChange(e1);
    failNext = true;
    expect(await desk.act(a.owner, updateId!, { type: "send" })).toMatchObject({ ok: false });
    expect(await db.firmUpdate.findUniqueOrThrow({ where: { id: updateId! } })).toMatchObject({ clientUpdate: "FAILED", clientUpdateError: "SMTP down" });
    expect(await desk.act(a.owner, updateId!, { type: "send" })).toMatchObject({ ok: true });
    expect(sent.at(-1)!.subject).toContain("Request for Additional Evidence Was Sent");

    const e2 = await moved(caseId, "Response To USCIS' Request For Evidence Was Received");
    const second = await desk.recordStatusChange(e2);
    expect(await desk.act(a.owner, second.updateId!, { type: "skip" })).toMatchObject({ ok: true });
    expect(await desk.act(a.owner, second.updateId!, { type: "send" })).toMatchObject({ ok: false });
  });

  it("assigns, snoozes, finishes and reopens updates, inside one firm only", async () => {
    const a = await mkFirm("D3");
    const b = await mkFirm("D3b");
    const outsider = await mkUser("D3-outsider");
    const { caseId } = await mkCase(a.staff, "EAC9999103404");
    const { updateId } = await desk.recordStatusChange(await moved(caseId, "Case Was Transferred And A New Office Has Jurisdiction"));
    const id = updateId!;

    expect(await desk.act(b.owner, id, { type: "resolve" })).toMatchObject({ ok: false });
    expect(await desk.list(outsider)).toBeNull();
    expect((await desk.list(b.owner))!.items).toEqual([]);
    expect(await desk.act(a.owner, id, { type: "assign", assigneeId: b.staff })).toMatchObject({ ok: false });
    expect(await desk.act(a.owner, id, { type: "assign", assigneeId: a.staff })).toMatchObject({ ok: true });
    expect((await desk.list(a.staff, "mine"))!.items.map((i) => i.id)).toEqual([id]);
    expect((await desk.list(a.owner, "mine"))!.items).toEqual([]);

    expect(await desk.act(a.staff, id, { type: "snooze", days: 2 })).toMatchObject({ ok: false });
    expect(await desk.act(a.staff, id, { type: "snooze", days: 3 })).toMatchObject({ ok: true });
    expect((await desk.list(a.staff))!.counts).toMatchObject({ open: 0, snoozed: 1 });
    clock = new Date(clock.getTime() + 4 * 86_400_000);
    expect((await desk.list(a.staff))!.counts).toMatchObject({ open: 1, snoozed: 0 });

    expect(await desk.act(a.staff, id, { type: "resolve" })).toMatchObject({ ok: true });
    expect((await desk.list(a.staff, "done"))!.items[0]).toMatchObject({ id, state: "DONE", resolvedBy: { name: "D3-staff" } });
    expect(await desk.act(a.staff, id, { type: "reopen" })).toMatchObject({ ok: true });
    expect((await desk.list(a.staff))!.counts.open).toBe(1);
    expect(await db.auditLog.count({ where: { firmId: a.firmId, action: { startsWith: "update." } } })).toBe(4);
  });

  it("serves the client's status page from a signed link that can be replaced or turned off", async () => {
    const a = await mkFirm("D4");
    const b = await mkFirm("D4b");
    const { clientId, caseId } = await mkCase(a.staff, "EAC9999103405");
    await moved(caseId, "Interview Was Scheduled");
    expect(await desk.setPortal(b.owner, clientId, "on")).toMatchObject({ ok: false });
    const v1 = (await db.client.findUniqueOrThrow({ where: { id: clientId } })).portalVersion;
    expect(await desk.portalView(portalToken(clientId, v1))).toBeNull(); // not turned on yet

    await desk.setPortal(a.staff, clientId, "on");
    const view = (await desk.portalView(portalToken(clientId, v1)))!;
    expect(view).toMatchObject({ firm: { name: "Firm D4" }, client: { displayName: "María López", locale: "es" } });
    expect(view.cases).toHaveLength(1);
    expect(view.cases[0]).toMatchObject({ receiptMasked: "EAC*******405", statusTitleEn: "Interview Was Scheduled", nextStep: { es: "Prepárese para su entrevista" } });
    expect(JSON.stringify(view)).not.toMatch(/9999103405|statusDescription/);

    const token = portalToken(clientId, v1);
    expect(await desk.portalView(`${token.slice(0, -2)}xx`)).toBeNull();
    await desk.setPortal(a.staff, clientId, "new");
    expect(await desk.portalView(token)).toBeNull();
    const v2 = v1 + 1;
    expect(await desk.portalView(portalToken(clientId, v2))).not.toBeNull();
    await desk.setPortal(a.staff, clientId, "off");
    expect(await desk.portalView(portalToken(clientId, v2))).toBeNull();
    await desk.setPortal(a.staff, clientId, "on");
    expect(await desk.portalView(portalToken(clientId, v2 + 1))).not.toBeNull();
    await svc.setClientArchived(a.owner, clientId, true);
    expect(await desk.portalView(portalToken(clientId, v2 + 1))).toBeNull();
  });
});
