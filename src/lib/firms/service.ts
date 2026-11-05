import { createHash, randomBytes } from "node:crypto";
import type { Firm, FirmMembership, FirmRole, PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { firmInviteEmail } from "@/lib/email/templates";
import { FIRM_PLANS } from "@/lib/plans";

/**
 * Law-firm workspaces (CasePingo Pro): creation, team, invitations.
 *
 * Rules
 * - One active firm per user (v1). Every check reads the caller's membership
 *   from the database, so a removed member loses access immediately.
 * - Owner: everything. Admin: invite Admin/Staff, revoke invites, remove Staff.
 *   Staff: no team management. Only an Owner changes roles.
 * - A firm always keeps at least one Owner.
 * - Every firm-scoped id passed in (invitation, member) is re-checked against
 *   the caller's own firm — guessing another firm's ids does nothing.
 */

export const TRIAL_DAYS = 14;
export const TRIAL_CASE_LIMIT = 10;
export const INVITE_TTL_DAYS = 7;

export type FirmContext = { firm: Firm; membership: FirmMembership };

export type FirmServiceDeps = {
  db: PrismaClient;
  mailer: EmailDriver;
  siteUrl: string;
  now?: () => Date;
};

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

const canManageTeam = (role: FirmRole) => role === "OWNER" || role === "ADMIN";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normEmail = (e: string) => e.trim().toLowerCase();

/** The caller's active firm and membership, or null. Every firm action starts here. */
export async function findFirmContext(db: PrismaClient, userId: string): Promise<FirmContext | null> {
  const membership = await db.firmMembership.findFirst({
    where: { userId, revokedAt: null, firm: { status: "ACTIVE" } },
    include: { firm: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  const { firm, ...m } = membership;
  return { firm, membership: m };
}

export function createFirmService({ db, mailer, siteUrl, now = () => new Date() }: FirmServiceDeps) {
  const getContext = (userId: string) => findFirmContext(db, userId);

  async function audit(firmId: string, actorUserId: string, action: string, targetType: string, targetId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType, targetId, metadata: metadata ?? undefined } });
  }

  async function createFirm(userId: string, name: string): Promise<{ ok: true; firm: Firm } | Fail> {
    const clean = name.trim().slice(0, 120);
    if (clean.length < 2) return fail("Enter your firm's name.");
    if (await getContext(userId)) return fail("You're already part of a firm workspace.");
    const t = now();
    const firm = await db.$transaction(async (tx) => {
      const f = await tx.firm.create({
        data: {
          name: clean,
          caseLimit: TRIAL_CASE_LIMIT,
          trialEndsAt: new Date(t.getTime() + TRIAL_DAYS * 86_400_000),
          memberships: { create: { userId, role: "OWNER" } },
        },
      });
      await tx.auditLog.create({ data: { firmId: f.id, actorUserId: userId, action: "firm.created", targetType: "Firm", targetId: f.id } });
      return f;
    });
    return { ok: true, firm };
  }

  async function listTeam(userId: string) {
    const ctx = await getContext(userId);
    if (!ctx) return null;
    const [members, invitations] = await Promise.all([
      db.firmMembership.findMany({
        where: { firmId: ctx.firm.id, revokedAt: null },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.firmInvitation.findMany({
        where: { firmId: ctx.firm.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now() } },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { ctx, members, invitations };
  }

  async function invite(
    userId: string,
    emailInput: string,
    role: FirmRole,
  ): Promise<{ ok: true; emailSent: boolean } | Fail> {
    const ctx = await getContext(userId);
    if (!ctx || !canManageTeam(ctx.membership.role)) return fail("Only an Owner or Admin can invite people.");
    if (role === "OWNER") return fail("Invite them as Admin, then an Owner can make them an Owner.");
    const email = normEmail(emailInput);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");

    const already = await db.firmMembership.findFirst({
      where: { firmId: ctx.firm.id, revokedAt: null, user: { email } },
      select: { id: true },
    });
    if (already) return fail("That person is already on your team.");

    const maxUsers = ctx.firm.plan ? FIRM_PLANS[ctx.firm.plan].maxUsers : null;
    if (maxUsers !== null) {
      const [members, pending] = await Promise.all([
        db.firmMembership.count({ where: { firmId: ctx.firm.id, revokedAt: null } }),
        db.firmInvitation.count({ where: { firmId: ctx.firm.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now() }, NOT: { email } } }),
      ]);
      if (members + pending >= maxUsers) {
        return fail(`${FIRM_PLANS[ctx.firm.plan!].label} includes ${maxUsers} team members. Switch to Firm in Billing for unlimited members.`);
      }
    }

    const token = randomBytes(32).toString("base64url");
    const t = now();
    const inv = await db.$transaction(async (tx) => {
      // Re-inviting replaces any pending invitation for the same email.
      await tx.firmInvitation.updateMany({
        where: { firmId: ctx.firm.id, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: t },
      });
      const created = await tx.firmInvitation.create({
        data: {
          firmId: ctx.firm.id,
          email,
          role,
          tokenHash: hashToken(token),
          invitedById: userId,
          expiresAt: new Date(t.getTime() + INVITE_TTL_DAYS * 86_400_000),
        },
      });
      await tx.auditLog.create({
        data: { firmId: ctx.firm.id, actorUserId: userId, action: "invite.sent", targetType: "FirmInvitation", targetId: created.id, metadata: { email, role } },
      });
      return created;
    });

    const inviter = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    try {
      await mailer.send(
        firmInviteEmail({
          to: email,
          firmName: ctx.firm.name,
          inviterName: inviter?.name ?? inviter?.email ?? "Your colleague",
          role,
          acceptUrl: `${siteUrl}/firm/invite/${token}`,
          expiresAt: inv.expiresAt,
        }),
      );
      return { ok: true, emailSent: true };
    } catch {
      return { ok: true, emailSent: false };
    }
  }

  async function revokeInvite(userId: string, invitationId: string): Promise<{ ok: true } | Fail> {
    const ctx = await getContext(userId);
    if (!ctx || !canManageTeam(ctx.membership.role)) return fail("Only an Owner or Admin can cancel invitations.");
    const { count } = await db.firmInvitation.updateMany({
      where: { id: invitationId, firmId: ctx.firm.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now() },
    });
    if (count === 0) return fail("Invitation not found.");
    await audit(ctx.firm.id, userId, "invite.revoked", "FirmInvitation", invitationId);
    return { ok: true };
  }

  /** Look up an invitation by its token for the accept page (no side effects). */
  async function previewInvite(token: string) {
    const inv = await db.firmInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { firm: { select: { name: true, status: true } } },
    });
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt <= now() || inv.firm.status !== "ACTIVE") return null;
    return { email: inv.email, role: inv.role, firmName: inv.firm.name };
  }

  async function acceptInvite(user: { id: string; email: string }, token: string): Promise<{ ok: true; firmId: string } | Fail> {
    const inv = await db.firmInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { firm: true } });
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt <= now() || inv.firm.status !== "ACTIVE") {
      return fail("This invitation is invalid or has expired. Ask your firm to send a new one.");
    }
    if (normEmail(user.email) !== inv.email) {
      return fail(`This invitation is for ${inv.email}. Sign in with that email to accept it.`);
    }
    const current = await getContext(user.id);
    if (current && current.firm.id !== inv.firmId) return fail("You're already part of another firm workspace. Leave it first.");

    await db.$transaction(async (tx) => {
      await tx.firmMembership.upsert({
        where: { firmId_userId: { firmId: inv.firmId, userId: user.id } },
        create: { firmId: inv.firmId, userId: user.id, role: inv.role },
        update: { role: inv.role, revokedAt: null },
      });
      await tx.firmInvitation.update({ where: { id: inv.id }, data: { acceptedAt: now() } });
      await tx.auditLog.create({
        data: { firmId: inv.firmId, actorUserId: user.id, action: "invite.accepted", targetType: "FirmInvitation", targetId: inv.id, metadata: { role: inv.role } },
      });
    });
    return { ok: true, firmId: inv.firmId };
  }

  async function ownerCount(firmId: string) {
    return db.firmMembership.count({ where: { firmId, role: "OWNER", revokedAt: null } });
  }

  async function changeRole(userId: string, membershipId: string, role: FirmRole): Promise<{ ok: true } | Fail> {
    const ctx = await getContext(userId);
    if (!ctx || ctx.membership.role !== "OWNER") return fail("Only an Owner can change roles.");
    const target = await db.firmMembership.findFirst({ where: { id: membershipId, firmId: ctx.firm.id, revokedAt: null } });
    if (!target) return fail("Team member not found.");
    if (target.role === "OWNER" && role !== "OWNER" && (await ownerCount(ctx.firm.id)) <= 1) {
      return fail("Your firm needs at least one Owner. Make someone else an Owner first.");
    }
    await db.firmMembership.update({ where: { id: target.id }, data: { role } });
    await audit(ctx.firm.id, userId, "member.role_changed", "FirmMembership", target.id, { from: target.role, to: role });
    return { ok: true };
  }

  async function removeMember(userId: string, membershipId: string): Promise<{ ok: true; self: boolean } | Fail> {
    const ctx = await getContext(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const target = await db.firmMembership.findFirst({ where: { id: membershipId, firmId: ctx.firm.id, revokedAt: null } });
    if (!target) return fail("Team member not found.");
    const self = target.userId === userId;
    const allowed =
      self ||
      ctx.membership.role === "OWNER" ||
      (ctx.membership.role === "ADMIN" && target.role === "STAFF");
    if (!allowed) return fail("You don't have permission to remove this person.");
    if (target.role === "OWNER" && (await ownerCount(ctx.firm.id)) <= 1) {
      return fail("Your firm needs at least one Owner. Make someone else an Owner first.");
    }
    await db.firmMembership.update({ where: { id: target.id }, data: { revokedAt: now() } });
    await audit(ctx.firm.id, userId, self ? "member.left" : "member.removed", "FirmMembership", target.id, { role: target.role });
    return { ok: true, self };
  }

  return { getContext, createFirm, listTeam, invite, revokeInvite, previewInvite, acceptInvite, changeRole, removeMember };
}

export type FirmService = ReturnType<typeof createFirmService>;
