import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import type { PushDriver } from "@/lib/push";
import { PLAN_LIMITS } from "@/lib/plans";
import { statusChangeEmail } from "@/lib/email/templates";
import { createFirmUpdateService } from "@/lib/firms/updates";

export type NotifyResult = { sent: number; skipped: number; failed: number };

type Recipient = { id: string; email: string; name: string | null; locale: string; emailOnChange: boolean };

/**
 * Email the people who should hear about a status change. Idempotent: each
 * (event, person, channel) has one NotificationDelivery row, so a retried job
 * never sends twice.
 *
 * Recipients:
 * - Individual case (Premium only; Free has no alerts): the owner, if their alerts are on; plus a push alert to
 *   their phones when they turned push on in the app.
 * - Firm case: the member who added it, while still on the team; otherwise
 *   the firm's Owners. Each person's own alert setting applies.
 */
export async function notifyStatusChange(
  db: PrismaClient,
  mailer: EmailDriver,
  eventId: string,
  siteUrl: string,
  pusher?: PushDriver,
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
    const owner = await db.user.findUnique({ where: { id: c.ownerUserId }, select: { ...userSelect, plan: true } });
    // Free has no alerts: the person sees changes when they press Check now.
    if (owner && !PLAN_LIMITS[owner.plan].alerts) return result;
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
  if (pusher && c.ownerUserId) {
    try {
      await pushToOwner(db, pusher, event, c, result);
    } catch (err) {
      firstError ??= err;
    }
  }
  // Firm cases: the change goes to the firm's Updates inbox, and the client is emailed per the firm's setting.
  if (c.firmId) {
    try {
      await createFirmUpdateService({ db, mailer, siteUrl }).recordStatusChange(event.id);
    } catch (err) {
      firstError ??= err;
    }
  }

  if (firstError) throw firstError; // let the job retry; already-sent people are skipped next time
  return result;
}

type EventWithCase = Awaited<ReturnType<PrismaClient["caseStatusEvent"]["findUnique"]>> & {};
type CaseRow = { id: string; ownerUserId: string | null; nickname: string | null; receiptMasked: string };

/** One push delivery per (event, owner), to all their active phones. Masked receipt only. */
async function pushToOwner(db: PrismaClient, pusher: PushDriver, event: EventWithCase, c: CaseRow, result: NotifyResult) {
  const owner = await db.user.findUnique({
    where: { id: c.ownerUserId! },
    select: { id: true, locale: true, plan: true, notificationPreference: { select: { pushOnChange: true } } },
  });
  if (!owner?.notificationPreference?.pushOnChange || !PLAN_LIMITS[owner.plan].alerts) return;
  const devices = await db.pushDevice.findMany({ where: { userId: owner.id, disabledAt: null }, select: { id: true, token: true } });
  if (!devices.length) return;

  const idempotencyKey = `${event.id}:${owner.id}:PUSH`;
  const existing = await db.notificationDelivery.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "SENT" || existing?.status === "SKIPPED") {
    result.skipped++;
    return;
  }
  const delivery =
    existing ?? (await db.notificationDelivery.create({ data: { eventId: event.id, userId: owner.id, channel: "PUSH", idempotencyKey, status: "PENDING" } }));

  const es = owner.locale === "es";
  const status = (es ? event.statusTitleEs : event.statusTitleEn) ?? event.statusTitleEn ?? (es ? "Estado actualizado" : "Status updated");
  const label = c.nickname ?? c.receiptMasked;
  const messages = devices.map((d) => ({
    to: d.token,
    title: es ? "Actualización de su caso" : "Case update",
    body: `${label}: ${status}`,
    data: { caseId: c.id },
  }));
  try {
    const results = await pusher.send(messages);
    const dead = devices.filter((_, i) => results[i]?.status === "dead").map((d) => d.id);
    if (dead.length) await db.pushDevice.updateMany({ where: { id: { in: dead } }, data: { disabledAt: new Date() } });
    const ok = results.some((r) => r.status === "ok");
    const errors = results.filter((r) => r.status === "error").map((r) => (r as { message: string }).message);
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: ok ? { status: "SENT", sentAt: new Date(), error: null } : { status: dead.length === results.length ? "SKIPPED" : "FAILED", error: errors[0] ?? "no active device" },
    });
    if (ok) result.sent++;
    else if (dead.length === results.length) result.skipped++;
    else {
      result.failed++;
      throw new Error(errors[0] ?? "push failed");
    }
  } catch (err) {
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", error: String((err as Error)?.message ?? err).slice(0, 300) } }).catch(() => {});
    throw err;
  }
}
