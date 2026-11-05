import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { statusChangeEmail } from "@/lib/email/templates";

export type NotifyResult = { sent: number; skipped: number; failed: number };

/**
 * Email the people who should hear about a status change. Idempotent: each
 * (event, person, channel) has one NotificationDelivery row, so a retried job
 * never sends twice.
 *
 * Recipients today: the individual owner, if their alerts are on. (Firm
 * recipients arrive with the firm workspace.)
 */
export async function notifyStatusChange(
  db: PrismaClient,
  mailer: EmailDriver,
  eventId: string,
  siteUrl: string,
): Promise<NotifyResult> {
  const result: NotifyResult = { sent: 0, skipped: 0, failed: 0 };
  const event = await db.caseStatusEvent.findUnique({
    where: { id: eventId },
    include: {
      case: { include: { ownerUser: { include: { notificationPreference: true } } } },
    },
  });
  const owner = event?.case.ownerUser;
  if (!event || !owner) return result;

  const wantsEmail = owner.notificationPreference?.emailOnChange ?? true;
  const idempotencyKey = `${event.id}:${owner.id}:EMAIL`;

  const existing = await db.notificationDelivery.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "SENT" || existing?.status === "SKIPPED") {
    result.skipped++;
    return result;
  }
  const delivery =
    existing ??
    (await db.notificationDelivery.create({
      data: { eventId: event.id, userId: owner.id, channel: "EMAIL", idempotencyKey, status: wantsEmail ? "PENDING" : "SKIPPED" },
    }));
  if (!wantsEmail) {
    result.skipped++;
    return result;
  }

  const c = event.case;
  const message = statusChangeEmail({
    to: owner.email,
    name: owner.name,
    locale: owner.locale,
    caseLabel: c.nickname ?? c.receiptMasked,
    receiptMasked: c.receiptMasked,
    formType: event.formType,
    statusTitleEn: event.statusTitleEn,
    statusTitleEs: event.statusTitleEs,
    caseUrl: `${siteUrl}/cases/${c.id}`,
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
    throw err; // let the job retry
  }
  return result;
}
