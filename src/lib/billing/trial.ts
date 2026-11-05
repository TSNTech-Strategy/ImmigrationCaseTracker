import type { PrismaClient } from "@prisma/client";
import { digest } from "@/lib/crypto";
import { receiptDigestOf } from "@/lib/cases/receipt-store";
import type { EmailDriver } from "@/lib/email";
import { trialEndedEmail, trialEndingEmail } from "@/lib/email/templates";
import { PREMIUM_TRIAL_DAYS } from "@/lib/plans";
import { createEntitlements } from "./entitlements";

/**
 * The 7-day Premium trial for new accounts, and its guard rails:
 *
 * - One trial per email address, even after the account is deleted. Gmail-style
 *   variations (dots, "+tag", googlemail.com) count as the same address.
 * - One trial per receipt number, across all accounts: adding a case that
 *   already had a trial elsewhere ends this account's trial (Free from then on).
 * - Throwaway email services are refused at sign-up (isDisposableEmail).
 * - Only one-way fingerprints are kept (TrialLedger), for 12 months.
 */

export const LEDGER_RETENTION_DAYS = 365;
const DAY = 86_400_000;

const GMAIL = new Set(["gmail.com", "googlemail.com"]);
/** Lower-case; for Gmail drop dots and "+tag"; for everyone else drop "+tag". */
export function canonicalEmail(email: string): string {
  const [rawUser, rawDomain] = email.trim().toLowerCase().split("@");
  if (!rawDomain) return email.trim().toLowerCase();
  let user = rawUser.split("+")[0];
  let domain = rawDomain;
  if (GMAIL.has(domain)) {
    user = user.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${user}@${domain}`;
}

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "tempmail.dev", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com", "getnada.com",
  "nada.email", "dispostable.com", "maildrop.cc", "throwawaymail.com", "mohmal.com", "emailondeck.com", "fakeinbox.com",
  "mintemail.com", "mailnesia.com", "spamgourmet.com", "burnermail.io", "moakt.com", "tmail.ws", "inboxkitten.com", "mailpoof.com",
]);
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}

const emailKey = (email: string) => `email:${digest(`trial-email:${canonicalEmail(email)}`)}`;
const receiptKey = (receipt: string) => `receipt:${receiptDigestOf(receipt)}`;

export function createTrialService({ db, mailer, siteUrl, now = () => new Date() }: { db: PrismaClient; mailer?: EmailDriver; siteUrl?: string; now?: () => Date }) {
  const ent = createEntitlements({ db, now });

  /** A brand-new account: start the Premium trial unless this email already had one. */
  async function grantNewAccountTrial(userId: string, email: string): Promise<{ granted: boolean }> {
    try {
      await db.trialLedger.create({ data: { key: emailKey(email), kind: "email" } });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { granted: false };
      throw err;
    }
    const t = now();
    await db.user.update({ where: { id: userId }, data: { plan: "PREMIUM", trialEndsAt: new Date(t.getTime() + PREMIUM_TRIAL_DAYS * DAY), trialNoticeStage: 0 } });
    await db.auditLog.create({ data: { actorUserId: userId, action: "trial.started", targetType: "User", targetId: userId, metadata: { days: PREMIUM_TRIAL_DAYS } } });
    return { granted: true };
  }

  /**
   * Before a case is added: if the person is on a trial and this receipt
   * number already had a trial on another account, end their trial now.
   * Otherwise record the receipt so it can't start another trial elsewhere.
   */
  async function guardReceiptDuringTrial(userId: string, receipt: string): Promise<{ trialEnded: boolean }> {
    const u = await db.user.findUnique({ where: { id: userId }, select: { trialEndsAt: true } });
    const t = now();
    if (!u?.trialEndsAt || u.trialEndsAt <= t) return { trialEnded: false };
    const key = receiptKey(receipt);
    const seen = await db.trialLedger.findUnique({ where: { key } });
    if (seen) {
      // The same person re-adding their own case during their trial is fine.
      const own = await db.trackedCase.findFirst({ where: { ownerUserId: userId, receiptDigest: receiptDigestOf(receipt) }, select: { id: true } });
      const hadItBefore = await db.auditLog.findFirst({ where: { actorUserId: userId, action: "trial.receipt", targetId: key }, select: { id: true } });
      if (!own && !hadItBefore) {
        await db.user.update({ where: { id: userId }, data: { trialEndsAt: t, trialNoticeStage: 2 } });
        await db.auditLog.create({ data: { actorUserId: userId, action: "trial.ended_reused_receipt", targetType: "User", targetId: userId } });
        await ent.applyUser(userId);
        return { trialEnded: true };
      }
      return { trialEnded: false };
    }
    await db.trialLedger.create({ data: { key, kind: "receipt" } }).catch(() => {});
    await db.auditLog.create({ data: { actorUserId: userId, action: "trial.receipt", targetType: "TrialLedger", targetId: key } });
    return { trialEnded: false };
  }

  /** Hourly: reminder 2 days before the end, end expired trials (with an email), prune old fingerprints. */
  async function runTrialJobs() {
    const t = now();
    let reminded = 0;
    let ended = 0;
    const soon = await db.user.findMany({
      where: { trialEndsAt: { gt: t, lte: new Date(t.getTime() + 2 * DAY) }, trialNoticeStage: 0, plan: "PREMIUM" },
      select: { id: true, email: true, name: true, trialEndsAt: true },
    });
    for (const u of soon) {
      if (await hasPaidPremium(u.id)) continue;
      if (mailer && siteUrl) await mailer.send(trialEndingEmail({ to: u.email, name: u.name, endsAt: u.trialEndsAt!, upgradeUrl: `${siteUrl}/settings#plan-h` }));
      await db.user.update({ where: { id: u.id }, data: { trialNoticeStage: 1 } });
      reminded++;
    }
    const expired = await db.user.findMany({
      where: { trialEndsAt: { lte: t }, trialNoticeStage: { lt: 2 } },
      select: { id: true, email: true, name: true },
    });
    for (const u of expired) {
      const r = await ent.applyUser(u.id);
      if (r?.plan === "FREE" && mailer && siteUrl) {
        await mailer.send(trialEndedEmail({ to: u.email, name: u.name, upgradeUrl: `${siteUrl}/settings#plan-h` }));
      }
      await db.user.update({ where: { id: u.id }, data: { trialNoticeStage: 2 } });
      ended++;
    }
    const { count: pruned } = await db.trialLedger.deleteMany({ where: { createdAt: { lt: new Date(t.getTime() - LEDGER_RETENTION_DAYS * DAY) } } });
    return { reminded, ended, pruned };
  }

  async function hasPaidPremium(userId: string) {
    const subs = await db.subscription.count({ where: { userId, product: "PREMIUM", status: { in: ["active", "trialing", "past_due"] } } });
    return subs > 0;
  }

  return { grantNewAccountTrial, guardReceiptDuringTrial, runTrialJobs };
}

export type TrialService = ReturnType<typeof createTrialService>;
