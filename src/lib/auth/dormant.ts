import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { dormantAccountEmail } from "@/lib/email/templates";

/**
 * Dormant-account clean-up, as the Privacy Policy promises: an account with no
 * sign-in for 24 months gets a warning email, and is deleted 30 days later if
 * nobody has signed in since. Paid subscribers and law-firm members are never
 * included (a firm's data is governed by the firm and the DPA).
 */

export const DORMANT_AFTER_MONTHS = 24;
export const DORMANT_GRACE_DAYS = 30;
const DAY = 86_400_000;

/** lastSeenAt is written at most this often (one write per user per day). */
export const LAST_SEEN_EVERY_MS = DAY;

export function dormantCutoff(now: Date): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - DORMANT_AFTER_MONTHS);
  return d;
}

type DormancyInput = { lastSeenAt: Date | null; createdAt: Date; dormantNoticeAt: Date | null };

/** What the clean-up should do with this (eligible) account now. */
export function dormancyAction(u: DormancyInput, now: Date): "warn" | "delete" | null {
  const lastActive = u.lastSeenAt ?? u.createdAt;
  if (u.dormantNoticeAt) {
    // Signed in after the warning: no longer dormant (the sign-in also clears the notice).
    if (lastActive > u.dormantNoticeAt) return null;
    return now.getTime() - u.dormantNoticeAt.getTime() >= DORMANT_GRACE_DAYS * DAY ? "delete" : null;
  }
  return lastActive <= dormantCutoff(now) ? "warn" : null;
}

/** Data for the session's daily lastSeenAt write, or null when no write is due. */
export function lastSeenUpdate(u: { lastSeenAt: Date | null; dormantNoticeAt: Date | null }, now: Date) {
  if (u.lastSeenAt && now.getTime() - u.lastSeenAt.getTime() < LAST_SEEN_EVERY_MS && !u.dormantNoticeAt) return null;
  return { lastSeenAt: now, dormantNoticeAt: null };
}

export function createDormantService({
  db,
  mailer,
  siteUrl,
  deleteAccount,
  now = () => new Date(),
}: {
  db: PrismaClient;
  mailer?: EmailDriver;
  siteUrl?: string;
  /** Deletes the sign-in account and our data (performAccountDeletion). */
  deleteAccount: (requestId: string, userId: string) => Promise<{ ok: boolean }>;
  now?: () => Date;
}) {
  /** Daily: warn accounts that went dormant, delete those still dormant after the grace period. */
  async function run() {
    const t = now();
    const cutoff = dormantCutoff(t);
    const candidates = await db.user.findMany({
      where: {
        OR: [
          { dormantNoticeAt: { not: null, lte: new Date(t.getTime() - DORMANT_GRACE_DAYS * DAY) } },
          { dormantNoticeAt: null, OR: [{ lastSeenAt: { lte: cutoff } }, { lastSeenAt: null, createdAt: { lte: cutoff } }] },
        ],
        memberships: { none: {} },
        subscriptions: { none: { status: { in: ["active", "trialing", "past_due"] } } },
      },
      select: { id: true, email: true, name: true, lastSeenAt: true, createdAt: true, dormantNoticeAt: true },
      take: 200,
    });

    let warned = 0;
    let deleted = 0;
    let failed = 0;
    for (const u of candidates) {
      const action = dormancyAction(u, t);
      if (action === "warn") {
        const deleteOn = new Date(t.getTime() + DORMANT_GRACE_DAYS * DAY);
        if (mailer && siteUrl) await mailer.send(dormantAccountEmail({ to: u.email, name: u.name, deleteOn, signInUrl: `${siteUrl}/login` }));
        await db.user.update({ where: { id: u.id }, data: { dormantNoticeAt: t } });
        await db.auditLog.create({ data: { actorUserId: null, action: "account.dormant_warned", targetType: "User", targetId: u.id } });
        warned++;
      } else if (action === "delete") {
        const request = await db.deletionRequest.create({
          data: { requesterId: u.id, requesterEmail: u.email, scope: "ACCOUNT", targetId: u.id, status: "IN_PROGRESS", notes: "Dormant account (24 months without sign-in)" },
        });
        const r = await deleteAccount(request.id, u.id);
        if (r.ok) deleted++;
        else failed++;
      }
    }
    return { warned, deleted, failed };
  }

  return { run };
}
