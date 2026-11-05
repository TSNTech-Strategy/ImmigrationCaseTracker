/** Firm workspaces against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { createFirmService, TRIAL_CASE_LIMIT } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("firm service", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const sent: EmailMessage[] = [];
  const mailer: EmailDriver = { name: "console", send: async (m) => void sent.push(m) };
  let clock = new Date("2027-02-01T12:00:00Z");
  const svc = createFirmService({ db, mailer, siteUrl: "https://casepingo.test", now: () => clock });
  const users: string[] = [];

  const mkUser = async (label: string) => {
    const u = await db.user.create({ data: { id: randomUUID(), email: `${label}-${randomUUID()}@test.dev` } });
    users.push(u.id);
    return u;
  };
  const tokenFrom = (m: EmailMessage) => /\/firm\/invite\/([A-Za-z0-9_-]+)/.exec(m.body)![1];
  const lastToken = () => tokenFrom(sent.at(-1)!);

  beforeEach(() => {
    sent.length = 0;
  });
  afterAll(async () => {
    await db.firm.deleteMany({ where: { memberships: { some: { userId: { in: users } } } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("creates a firm with the creator as Owner and a 14-day, 10-case trial", async () => {
    const owner = await mkUser("owner");
    const r = await svc.createFirm(owner.id, "  Rivera Immigration Law  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.firm).toMatchObject({ name: "Rivera Immigration Law", caseLimit: TRIAL_CASE_LIMIT });
    expect((r.firm.trialEndsAt!.getTime() - clock.getTime()) / 86_400_000).toBe(14);
    const ctx = await svc.getContext(owner.id);
    expect(ctx?.membership.role).toBe("OWNER");
    expect(await db.auditLog.count({ where: { firmId: r.firm.id, action: "firm.created" } })).toBe(1);
    expect(await svc.createFirm(owner.id, "Second firm")).toMatchObject({ ok: false });
  });

  it("invites by email, and only the invited address can accept, once", async () => {
    const owner = await mkUser("o");
    const f = await svc.createFirm(owner.id, "Firm One");
    if (!f.ok) throw new Error();
    const staff = await mkUser("staff");
    const other = await mkUser("other");

    expect(await svc.invite(owner.id, staff.email.toUpperCase(), "STAFF")).toEqual({ ok: true, emailSent: true });
    expect(sent[0].to).toBe(staff.email);
    expect(sent[0].subject).toContain("Firm One");
    const token = lastToken();

    expect(await svc.previewInvite(token)).toMatchObject({ email: staff.email, role: "STAFF", firmName: "Firm One" });
    expect(await svc.acceptInvite(other, token)).toMatchObject({ ok: false, error: expect.stringContaining(staff.email) });
    expect(await svc.acceptInvite(staff, token)).toEqual({ ok: true, firmId: f.firm.id });
    expect((await svc.getContext(staff.id))?.membership.role).toBe("STAFF");
    // Single use
    expect(await svc.acceptInvite(staff, token)).toMatchObject({ ok: false });
    expect(await svc.previewInvite(token)).toBeNull();
    // The token is stored only as a hash
    expect(await db.firmInvitation.count({ where: { tokenHash: token } })).toBe(0);
  });

  it("rejects expired and revoked invitations; re-inviting replaces the old link", async () => {
    const owner = await mkUser("o");
    await svc.createFirm(owner.id, "Firm Two");
    const guest = await mkUser("guest");
    await svc.invite(owner.id, guest.email, "ADMIN");
    const first = lastToken();
    await svc.invite(owner.id, guest.email, "ADMIN");
    const second = lastToken();
    expect(await svc.acceptInvite(guest, first)).toMatchObject({ ok: false });

    const team = await svc.listTeam(owner.id);
    expect(team?.invitations).toHaveLength(1);
    expect(await svc.revokeInvite(owner.id, team!.invitations[0].id)).toEqual({ ok: true });
    expect(await svc.acceptInvite(guest, second)).toMatchObject({ ok: false });

    await svc.invite(owner.id, guest.email, "ADMIN");
    const third = lastToken();
    clock = new Date(clock.getTime() + 8 * 86_400_000);
    expect(await svc.acceptInvite(guest, third)).toMatchObject({ ok: false, error: expect.stringContaining("expired") });
  });

  it("enforces roles: Staff can't manage the team; Admin can't invite Owners or remove Admins", async () => {
    const owner = await mkUser("o");
    await svc.createFirm(owner.id, "Firm Three");
    const admin = await mkUser("admin");
    const staff = await mkUser("staff");
    await svc.invite(owner.id, admin.email, "ADMIN");
    await svc.acceptInvite(admin, lastToken());
    await svc.invite(admin.id, staff.email, "STAFF");
    await svc.acceptInvite(staff, lastToken());

    expect(await svc.invite(staff.id, "x@test.dev", "STAFF")).toMatchObject({ ok: false });
    expect(await svc.invite(admin.id, "y@test.dev", "OWNER")).toMatchObject({ ok: false });

    const team = (await svc.listTeam(owner.id))!;
    const m = (uid: string) => team.members.find((x) => x.userId === uid)!.id;
    expect(await svc.changeRole(admin.id, m(staff.id), "ADMIN")).toMatchObject({ ok: false });
    expect(await svc.removeMember(staff.id, m(admin.id))).toMatchObject({ ok: false });
    expect(await svc.removeMember(admin.id, m(owner.id))).toMatchObject({ ok: false });
    // Admin may remove Staff, and the removal is immediate
    expect(await svc.removeMember(admin.id, m(staff.id))).toEqual({ ok: true, self: false });
    expect(await svc.getContext(staff.id)).toBeNull();
    expect(await svc.listTeam(staff.id)).toBeNull();
  });

  it("never leaves a firm without an Owner", async () => {
    const owner = await mkUser("o");
    await svc.createFirm(owner.id, "Firm Four");
    const admin = await mkUser("a");
    await svc.invite(owner.id, admin.email, "ADMIN");
    await svc.acceptInvite(admin, lastToken());
    const team = (await svc.listTeam(owner.id))!;
    const ownerM = team.members.find((x) => x.userId === owner.id)!.id;
    const adminM = team.members.find((x) => x.userId === admin.id)!.id;

    expect(await svc.removeMember(owner.id, ownerM)).toMatchObject({ ok: false, error: expect.stringContaining("Owner") });
    expect(await svc.changeRole(owner.id, ownerM, "ADMIN")).toMatchObject({ ok: false });
    // Promote someone else first, then the original Owner can step down and leave
    expect(await svc.changeRole(owner.id, adminM, "OWNER")).toEqual({ ok: true });
    expect(await svc.removeMember(owner.id, ownerM)).toEqual({ ok: true, self: true });
    expect(await svc.getContext(owner.id)).toBeNull();
  });

  it("isolates firms: ids from another firm do nothing", async () => {
    const ownerA = await mkUser("oa");
    const ownerB = await mkUser("ob");
    await svc.createFirm(ownerA.id, "Firm A");
    await svc.createFirm(ownerB.id, "Firm B");
    const staffB = await mkUser("sb");
    await svc.invite(ownerB.id, staffB.email, "STAFF");
    const tokenB = lastToken();
    const teamB = (await svc.listTeam(ownerB.id))!;

    expect(await svc.revokeInvite(ownerA.id, teamB.invitations[0].id)).toMatchObject({ ok: false });
    expect(await svc.removeMember(ownerA.id, teamB.members[0].id)).toMatchObject({ ok: false });
    expect(await svc.changeRole(ownerA.id, teamB.members[0].id, "STAFF")).toMatchObject({ ok: false });
    expect((await svc.listTeam(ownerA.id))!.members.map((m) => m.userId)).toEqual([ownerA.id]);
    // A member of firm A can't accept an invitation into firm B
    await svc.acceptInvite(staffB, tokenB);
    const outsider = await mkUser("x");
    await svc.invite(ownerA.id, outsider.email, "STAFF");
    const tokenA = lastToken();
    await svc.invite(ownerB.id, outsider.email, "STAFF");
    await svc.acceptInvite(outsider, tokenA);
    expect(await svc.acceptInvite(outsider, lastToken())).toMatchObject({ ok: false, error: expect.stringContaining("another firm") });
  });
});
