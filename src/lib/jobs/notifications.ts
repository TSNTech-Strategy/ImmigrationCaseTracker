import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { statusChangeEmail } from "@/lib/email/templates";

export type NotifyResult = { sent: number; skipped: number; failed: number };

type Recipient = { id: string; email: string; name: string | null; locale: string; emailOnChange: boolean };

/**
 * Email the people who should hear about a status change. Idempotent: each
 * (event, person, channel) has one NotificationDelivery row, so a retried job
 * never sends twice.
 *
 * Recipients:
 * - Individual case: the owner, if their alerts are on.
 * - Firm case: the member who added it, while still on the team; otherwise
 *   the firm's Owners. Each person's own alert setting applies.
 */
export async function notifyStatusChange(
  db: PrismaClient,
  mailer: EmailDriver,
  eventId: string,
  siteUrl: string,
): Promise<NotifyResult> {
  const result: NotifyResult = { sent: 0, skipped: 0, failed: 0 };
  const event = await db.caseStatusEvent.findUnique({ where: { id: eventId }, include: { case: true } });
  if (!event) return result;
  const c = event.case;

  const userSelect = { id: true, email: true, name: true, locale: true, notificationPreference: { select: { emailOnChange: true } } } as const;
  const toRecipient = (u: { id: string; email: string; name: string | null; locale: string; notificationPreference: { emailOnChange: boolean } | null }): Recipient => ({
    id: u.id,
    email: u.email,
    name: u.name,
    locale: u.locale,
    emailOnChange: u.notificationPreference?.emailOnChange ?? true,
  });

  let recipients: Recipient[] = [];
  let caseUrl = `${siteUrl}/cases/${c.id}`;
  if (c.ownerUserId) {
    const owner = await db.user.findUnique({ where: { id: c.ownerUserId }, select: userSelect });
    if (owner) recipients = [toRecipient(owner)];
  } else if (c.firmId) {
    caseUrl = `${siteUrl}/firm/cases/${c.id}`;
    const members = await db.firmMembership.findMany({
      where: { firmId: c.firmId, revokedAt: null, firm: { status: "ACTIVE" } },
      select: { userId: true, role: true, user: { select: userSelect } },
    });
    const adder = members.find((m) => m.userId === c.addedById);
    recipients = (adder ? [adder] : members.filter((m) => m.role === "OWNER")).map((m) => toRecipient(m.user));
  }

  let firstError: unknown;
  for (const r of recipients) {
    const idempotencyKey = `${event.id}:${r.id}:EMAIL`;
    const existing = await db.notificationDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "SENT" || existing?.status === "SKIPPED") {
      result.skipped++;
      continue;
    }
    const delivery =
      existing ??
      (await db.notificationDelivery.create({
        data: { eventId: event.id, userId: r.id, channel: "EMAIL", idempotencyKey, status: r.emailOnChange ? "PENDING" : "SKIPPED" },
      }));
    if (!r.emailOnChange) {
      result.skipped++;
      continue;
    }
    const message = statusChangeEmail({
      to: r.email,
      name: r.name,
      locale: r.locale,
      caseLabel: c.nickname ?? c.receiptMasked,
      receiptMasked: c.receiptMasked,
      formType: event.formType,
      statusTitleEn: event.statusTitleEn,
      statusTitleEs: event.statusTitleEs,
      caseUrl,
      settingsUrl: `${siteUrl}/settings`,
    });
    try {
      await mailer.send(message);
      await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
      result.sent++;
    } catch (err) {
      await db.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: String((err as Error)?.message ?? err).slice(0, 300) },
      });
      result.failed++;
      firstError ??= err;
    }
  }
  if (firstError) throw firstError; // let the job retry; already-sent people are skipped next time
  return result;
}
