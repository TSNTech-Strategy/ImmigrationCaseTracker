import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { staffCaseUpdateEmail } from "@/lib/email/templates";
import { statusCategory } from "@/lib/status-category";
import { formInfo } from "@/lib/case-insights";
import { findFirmContext } from "./service";
import { easternDay } from "./alerts";

/**
 * People in the firm: job titles and last active (team page), and each person's own settings:
 * where the Inbox opens, a backup while away, and which USCIS changes email them.
 */

export const TITLES = { ATTORNEY: "Attorney", PARALEGAL: "Paralegal", LEGAL_ASSISTANT: "Legal assistant", OTHER: "Other" } as const;
export type Title = keyof typeof TITLES;
export const CASE_EMAIL_SCOPES = { none: "Don't email me", mine: "Cases assigned to me", all: "Every firm case" } as const;
export const CASE_EMAIL_KINDS = {
  action: "Action may be needed (RFE, NOID, interview, biometrics)",
  done: "Approvals and cards",
  stop: "Denials, rejections, closures",
  progress: "Other progress (received, in review, transferred)",
} as const;

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const ACTIVE_EVERY_MS = 5 * 60_000;

/**
 * Who a new inbox item should go to: the person, or their backup while they're away
 * (through their "away until" day in the firm's time zone, and only if the backup is still a member).
 */
export async function inboxOwner(db: PrismaClient, firmId: string, userId: string | null, at: Date): Promise<string | null> {
  if (!userId) return null;
  const m = await db.firmMembership.findFirst({ where: { firmId, userId, revokedAt: null }, select: { awayUntil: true, backupUserId: true, firm: { select: { timeZone: true } } } });
  if (!m?.awayUntil || !m.backupUserId) return userId;
  if (m.awayUntil.toISOString().slice(0, 10) < easternDay(at, m.firm.timeZone)) return userId;
  const backup = await db.firmMembership.findFirst({ where: { firmId, userId: m.backupUserId, revokedAt: null }, select: { userId: true } });
  return backup?.userId ?? userId;
}

export function createFirmTeamService({ db, mailer, siteUrl, now = () => new Date() }: { db: PrismaClient; mailer: EmailDriver; siteUrl: string; now?: () => Date }) {
  /** Record that someone opened the workspace (at most every few minutes). */
  async function touch(userId: string) {
    const t = now();
    await db.firmMembership.updateMany({ where: { userId, revokedAt: null, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(t.getTime() - ACTIVE_EVERY_MS) } }] }, data: { lastActiveAt: t } });
  }

  /** Members with title, last active, cases assigned and open inbox items. */
  async function people(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const firmId = ctx.firm.id;
    const t = now();
    const [members, cases, inbox] = await Promise.all([
      db.firmMembership.findMany({ where: { firmId, revokedAt: null }, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: "asc" } }),
      db.trackedCase.groupBy({ by: ["assigneeId"], where: { firmId, assigneeId: { not: null } }, _count: { _all: true } }),
      db.firmUpdate.groupBy({ by: ["assignedToId"], where: { firmId, assignedToId: { not: null }, OR: [{ state: "OPEN" }, { state: "SNOOZED", snoozedUntil: { lte: t } }] }, _count: { _all: true } }),
    ]);
    const caseCount = new Map(cases.map((c) => [c.assigneeId, c._count._all]));
    const inboxCount = new Map(inbox.map((c) => [c.assignedToId, c._count._all]));
    const today = easternDay(t, ctx.firm.timeZone);
    const names = new Map(members.map((m) => [m.userId, m.user.name ?? m.user.email]));
    return {
      ctx,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name ?? m.user.email,
        email: m.user.email,
        hasName: Boolean(m.user.name),
        role: m.role,
        title: (m.title as Title | null) ?? null,
        lastActiveAt: m.lastActiveAt,
        cases: caseCount.get(m.userId) ?? 0,
        openItems: inboxCount.get(m.userId) ?? 0,
        away: m.awayUntil && m.awayUntil.toISOString().slice(0, 10) >= today ? { until: m.awayUntil, backup: m.backupUserId ? (names.get(m.backupUserId) ?? null) : null } : null,
      })),
    };
  }

  async function setTitle(actorId: string, membershipId: string, title: string): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, actorId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (ctx.membership.role === "STAFF") return fail("Only an Owner or Admin can change titles.");
    const value = title === "" ? null : title;
    if (value !== null && !(value in TITLES)) return fail("Choose a title from the list.");
    const m = await db.firmMembership.findFirst({ where: { id: membershipId, firmId: ctx.firm.id, revokedAt: null }, include: { user: { select: { name: true, email: true } } } });
    if (!m) return fail("Member not found.");
    if (m.title === value) return { ok: true };
    await db.firmMembership.update({ where: { id: m.id }, data: { title: value } });
    await db.auditLog.create({ data: { firmId: ctx.firm.id, actorUserId: actorId, action: "member.title", targetType: "FirmMembership", targetId: m.id, metadata: { member: m.user.name ?? m.user.email, title: value ? TITLES[value as Title] : null } } });
    return { ok: true };
  }

  async function preferences(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const m = await db.firmMembership.findUniqueOrThrow({ where: { id: ctx.membership.id } });
    const others = await db.firmMembership.findMany({ where: { firmId: ctx.firm.id, revokedAt: null, userId: { not: userId } }, select: { userId: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } });
    return {
      ctx,
      prefs: {
        inboxView: m.inboxView as "mine" | "all",
        caseEmails: m.caseEmails as keyof typeof CASE_EMAIL_SCOPES,
        caseEmailKinds: m.caseEmailKinds,
        awayUntil: m.awayUntil ? m.awayUntil.toISOString().slice(0, 10) : "",
        backupUserId: m.backupUserId ?? "",
      },
      colleagues: others.map((o) => ({ id: o.userId, name: o.user.name ?? o.user.email })),
      today: easternDay(now(), ctx.firm.timeZone),
    };
  }

  async function savePreferences(userId: string, input: { inboxView: string; caseEmails: string; caseEmailKinds: string[]; awayUntil: string; backupUserId: string }): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (input.inboxView !== "mine" && input.inboxView !== "all") return fail("Choose where your Inbox opens.", "inboxView");
    if (!(input.caseEmails in CASE_EMAIL_SCOPES)) return fail("Choose which cases email you.", "caseEmails");
    const kinds = [...new Set(input.caseEmailKinds)];
    if (kinds.some((k) => !(k in CASE_EMAIL_KINDS))) return fail("Choose from the list.", "caseEmailKinds");
    if (input.caseEmails !== "none" && kinds.length === 0) return fail("Choose at least one kind of change, or turn these emails off.", "caseEmailKinds");
    let awayUntil: Date | null = null;
    let backupUserId: string | null = null;
    if (input.awayUntil) {
      if (!isDay(input.awayUntil)) return fail("Enter a date.", "awayUntil");
      if (input.awayUntil < easternDay(now(), ctx.firm.timeZone)) return fail("Choose today or a later day.", "awayUntil");
      if (!input.backupUserId) return fail("Choose who covers for you.", "backupUserId");
      awayUntil = new Date(`${input.awayUntil}T00:00:00Z`);
    }
    if (input.backupUserId) {
      if (input.backupUserId === userId) return fail("Choose someone else.", "backupUserId");
      const b = await db.firmMembership.findFirst({ where: { firmId: ctx.firm.id, userId: input.backupUserId, revokedAt: null }, select: { userId: true } });
      if (!b) return fail("Choose a member of your firm.", "backupUserId");
      backupUserId = b.userId;
    }
    await db.firmMembership.update({ where: { id: ctx.membership.id }, data: { inboxView: input.inboxView, caseEmails: input.caseEmails, caseEmailKinds: kinds, awayUntil, backupUserId } });
    return { ok: true };
  }

  /** Email the members who asked to hear about this USCIS change (never the client; that's the client update). */
  async function notifyCaseChange(updateId: string): Promise<number> {
    const u = await db.firmUpdate.findUnique({
      where: { id: updateId },
      select: {
        firmId: true,
        firm: { select: { name: true, status: true } },
        event: { select: { statusTitleEn: true, formType: true } },
        case: { select: { id: true, assigneeId: true, receiptMasked: true, nickname: true, formType: true, client: { select: { displayName: true } } } },
      },
    });
    if (!u?.event || !u.case || u.firm.status !== "ACTIVE") return 0;
    const kind = statusCategory(u.event.statusTitleEn);
    if (kind === "none") return 0;
    const members = await db.firmMembership.findMany({
      where: { firmId: u.firmId, revokedAt: null, caseEmails: { not: "none" }, caseEmailKinds: { has: kind } },
      select: { userId: true, caseEmails: true, user: { select: { email: true, name: true } } },
    });
    const to = members.filter((m) => m.caseEmails === "all" || m.userId === u.case!.assigneeId);
    for (const m of to) {
      await mailer.send(
        staffCaseUpdateEmail({
          to: m.user.email,
          name: m.user.name,
          firmName: u.firm.name,
          clientName: u.case.client?.displayName ?? null,
          caseLabel: u.case.nickname ?? `${formInfo(u.event.formType ?? u.case.formType)?.code ?? "Case"} ${u.case.receiptMasked}`,
          status: u.event.statusTitleEn ?? "Status updated",
          caseUrl: `${siteUrl}/firm/cases/${u.case.id}`,
          settingsUrl: `${siteUrl}/firm/settings/notifications`,
        }),
      );
    }
    return to.length;
  }

  return { touch, people, setTitle, preferences, savePreferences, notifyCaseChange };
}
