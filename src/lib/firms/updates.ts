import type { ClientUpdateMode, ClientUpdateState, Prisma, PrismaClient } from "@prisma/client";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { clientUpdateEmail } from "@/lib/email/templates";
import { formInfo } from "@/lib/case-insights";
import { caseViewSelect } from "@/lib/cases/service";
import { caseJourney } from "@/lib/journeys";
import { nextStepFor } from "@/lib/my-cases";
import { findStatusGuide, guideText } from "@/lib/status-guide";
import { portalPath, readPortalToken } from "./portal";
import { findFirmContext, type FirmContext } from "./service";
import { DEADLINE_KINDS, daysUntil, dueText, easternDay, formatDue } from "./alerts";

/**
 * The firm's status desk (CasePingo Pro).
 *
 * - Updates inbox: every status change on a firm case (after its first status)
 *   becomes one item the team can assign, snooze and mark done.
 * - Client updates: the firm chooses Off, Review first or Automatic. A client
 *   gets an email only with an address and a recorded agreement; each change is
 *   sent at most once (claimed before sending), in the client's language.
 * - Client status page: a signed, revocable read-only link per client.
 *
 * Every query is scoped to the caller's firm; another firm's items look missing.
 * Client contact details are never copied into the activity log.
 */

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export type UpdatesTab = "open" | "mine" | "snoozed" | "done";
export const UPDATES_TABS: Record<UpdatesTab, string> = { open: "Open", mine: "Assigned to me", snoozed: "Snoozed", done: "Done" };
export const SNOOZE_DAYS = [1, 3, 7] as const;
export const CLIENT_UPDATE_MODES: Record<ClientUpdateMode, { label: string; help: string }> = {
  OFF: { label: "Off", help: "Clients aren't emailed. Changes still come to your Updates inbox." },
  REVIEW: { label: "Review first", help: "Each change waits in Updates until someone on your team sends or skips the client's email." },
  AUTO: { label: "Automatic", help: "Clients are emailed as soon as CasePingo sees the change. You still see every change in Updates." },
};
const LIST_LIMIT = 100;

export type UpdateAction =
  | { type: "assign"; assigneeId: string | null }
  | { type: "snooze"; days: number }
  | { type: "resolve" }
  | { type: "reopen" }
  | { type: "send" }
  | { type: "skip" };

type ClientForUpdate = { id: string; displayName: string; email: string | null; locale: string; updatesConsentAt: Date | null; archivedAt: Date | null; portalEnabled: boolean; portalVersion: number };
type FirmForUpdate = { name: string; clientUpdates: ClientUpdateMode; clientContactLine: string | null; replyToEmail: string | null };
type EventForUpdate = { statusTitleEn: string | null; statusTitleEs: string | null; formType: string | null };

const canEmail = (c: ClientForUpdate | null | undefined): c is ClientForUpdate & { email: string } => Boolean(c && !c.archivedAt && c.email && c.updatesConsentAt);

export function createFirmUpdateService({ db, mailer, siteUrl, now = () => new Date() }: { db: PrismaClient; mailer: EmailDriver; siteUrl: string; now?: () => Date }) {
  async function audit(firmId: string, actorUserId: string | null, action: string, targetType: string, targetId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType, targetId, metadata: metadata ?? undefined } });
  }

  /** The email a client gets about one change (also shown to staff as a preview). */
  function buildClientUpdate(firm: FirmForUpdate, client: ClientForUpdate & { email: string }, c: { receiptMasked: string; formType: string | null }, event: EventForUpdate): EmailMessage {
    const lang = client.locale === "es" ? "es" : "en";
    const guide = findStatusGuide(event.statusTitleEn);
    const text = guide ? guideText(guide, lang) : null;
    const formType = event.formType ?? c.formType;
    const status = (lang === "es" ? event.statusTitleEs : event.statusTitleEn) ?? event.statusTitleEn ?? (lang === "es" ? "Estado actualizado" : "Status updated");
    return clientUpdateEmail({
      to: client.email,
      locale: lang,
      firmName: firm.name,
      clientName: client.displayName,
      formCode: formInfo(formType)?.code ?? null,
      receiptMasked: c.receiptMasked,
      status,
      meaning: text?.meaning ?? null,
      next: text?.next ?? null,
      nextStep: nextStepFor(event.statusTitleEn, formType)[lang],
      portalUrl: client.portalEnabled ? `${siteUrl}${portalPath(client.id, client.portalVersion)}` : null,
      contactLine: firm.clientContactLine,
      replyTo: firm.replyToEmail,
    });
  }

  /**
   * A firm case's status changed (scheduled check or a manual one): add it to the
   * Updates inbox and handle the client's email per the firm's setting. Idempotent
   * per change. The first status a case gets when tracking starts isn't an update.
   */
  async function recordStatusChange(eventId: string): Promise<{ updateId: string | null; clientUpdate?: ClientUpdateState }> {
    const event = await db.caseStatusEvent.findUnique({
      where: { id: eventId },
      select: { id: true, caseId: true, firstObservedAt: true, case: { select: { firmId: true, assigneeId: true, client: true, firm: { select: { status: true, clientUpdates: true } } } } },
    });
    const firmId = event?.case.firmId;
    if (!event || !firmId || event.case.firm?.status !== "ACTIVE") return { updateId: null };
    // Any other status seen for this case up to now (same instant included) means this one is a change.
    const earlier = await db.caseStatusEvent.count({ where: { caseId: event.caseId, id: { not: event.id }, firstObservedAt: { lte: event.firstObservedAt } } });
    if (earlier === 0) return { updateId: null };

    const mode = event.case.firm.clientUpdates;
    const initial: ClientUpdateState = mode === "OFF" ? "NONE" : canEmail(event.case.client) ? "PENDING" : "NO_CLIENT";
    let update = await db.firmUpdate.findUnique({ where: { eventId } });
    if (!update) {
      try {
        update = await db.firmUpdate.create({ data: { firmId, caseId: event.caseId, eventId, clientUpdate: initial, assignedToId: event.case.assigneeId } });
      } catch (err) {
        // Another run created it a moment ago.
        if ((err as { code?: string }).code !== "P2002") throw err;
        update = await db.firmUpdate.findUniqueOrThrow({ where: { eventId } });
      }
    }
    // USCIS moved the case: an open "no change for a long time" alert on it is over.
    await db.firmUpdate.updateMany({ where: { caseId: event.caseId, kind: "STUCK", state: { not: "DONE" } }, data: { state: "DONE", resolvedAt: now(), snoozedUntil: null } });
    if (mode === "AUTO" && (update.clientUpdate === "PENDING" || update.clientUpdate === "SENDING")) {
      return { updateId: update.id, clientUpdate: await sendClientUpdate(update.id, null) };
    }
    return { updateId: update.id, clientUpdate: update.clientUpdate };
  }

  /** Sends one change's client email at most once: it's claimed first, so retries and double clicks can't send twice. */
  async function sendClientUpdate(updateId: string, actorUserId: string | null): Promise<ClientUpdateState> {
    const claimed = await db.firmUpdate.updateMany({ where: { id: updateId, clientUpdate: { in: ["PENDING", "FAILED"] } }, data: { clientUpdate: "SENDING" } });
    if (claimed.count === 0) return (await db.firmUpdate.findUnique({ where: { id: updateId }, select: { clientUpdate: true } }))?.clientUpdate ?? "NONE";
    const u = await db.firmUpdate.findUniqueOrThrow({
      where: { id: updateId },
      select: { id: true, firmId: true, caseId: true, event: { select: { statusTitleEn: true, statusTitleEs: true, formType: true } }, firm: true, case: { select: { receiptMasked: true, formType: true, client: true } } },
    });
    const client = u.case.client;
    if (!u.event) {
      await db.firmUpdate.update({ where: { id: u.id }, data: { clientUpdate: "NONE" } });
      return "NONE";
    }
    // Checked again at send time: the address or the agreement may have been removed since.
    if (!canEmail(client)) {
      await db.firmUpdate.update({ where: { id: u.id }, data: { clientUpdate: "NO_CLIENT" } });
      return "NO_CLIENT";
    }
    try {
      await mailer.send(buildClientUpdate(u.firm, client, u.case, u.event));
      await db.firmUpdate.update({ where: { id: u.id }, data: { clientUpdate: "SENT", clientUpdateAt: now(), clientUpdateById: actorUserId, clientUpdateError: null } });
      await audit(u.firmId, actorUserId, "client_update.sent", "TrackedCase", u.caseId, { automatic: actorUserId === null, language: client.locale });
      return "SENT";
    } catch (err) {
      await db.firmUpdate.update({ where: { id: u.id }, data: { clientUpdate: "FAILED", clientUpdateError: String((err as Error)?.message ?? err).slice(0, 300) } });
      return "FAILED";
    }
  }

  // ---- Updates inbox (any member) ---------------------------------------------------

  function tabWhere(firmId: string, tab: UpdatesTab, userId: string, t: Date): Prisma.FirmUpdateWhereInput {
    const due: Prisma.FirmUpdateWhereInput = { OR: [{ state: "OPEN" }, { state: "SNOOZED", snoozedUntil: { lte: t } }] };
    switch (tab) {
      case "open":
        return { AND: [{ firmId }, due] };
      case "mine":
        return { AND: [{ firmId, assignedToId: userId }, due] };
      case "snoozed":
        return { firmId, state: "SNOOZED", snoozedUntil: { gt: t } };
      case "done":
        return { firmId, state: "DONE" };
    }
  }

  async function list(userId: string, tab: UpdatesTab = "open") {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const t = now();
    const firmId = ctx.firm.id;
    const [items, open, mine, snoozed, members] = await Promise.all([
      db.firmUpdate.findMany({
        where: tabWhere(firmId, tab, userId, t),
        orderBy: tab === "done" ? [{ resolvedAt: "desc" }] : [{ createdAt: "desc" }],
        take: LIST_LIMIT,
        select: {
          id: true,
          state: true,
          snoozedUntil: true,
          resolvedAt: true,
          clientUpdate: true,
          clientUpdateAt: true,
          clientUpdateError: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { name: true, email: true } },
          clientUpdateBy: { select: { name: true, email: true } },
          kind: true,
          stuckDays: true,
          deadline: { select: { id: true, kind: true, dueOn: true, note: true, doneAt: true } },
          event: { select: { statusTitleEn: true, statusTitleEs: true, formType: true, firstObservedAt: true } },
          case: { select: { id: true, receiptMasked: true, nickname: true, formType: true, statusTitleEn: true, client: true } },
        },
      }),
      db.firmUpdate.count({ where: tabWhere(firmId, "open", userId, t) }),
      db.firmUpdate.count({ where: tabWhere(firmId, "mine", userId, t) }),
      db.firmUpdate.count({ where: tabWhere(firmId, "snoozed", userId, t) }),
      db.firmMembership.findMany({ where: { firmId, revokedAt: null }, select: { userId: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      ctx,
      counts: { open, mine, snoozed },
      members: members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })),
      items: items.map((u) => {
        const client = u.case.client;
        const preview = (u.clientUpdate === "PENDING" || u.clientUpdate === "FAILED") && canEmail(client) && u.event ? buildClientUpdate(ctx.firm, client, u.case, u.event) : null;
        const caseView = { id: u.case.id, receiptMasked: u.case.receiptMasked, nickname: u.case.nickname, formType: u.case.formType, statusTitleEn: u.case.statusTitleEn };
        const today = easternDay(t, ctx.firm.timeZone);
        const d = u.deadline;
        const overdue = Boolean(d && !d.doneAt && daysUntil(d.dueOn, today) < 0);
        const title = u.event
          ? (u.event.statusTitleEn ?? "Status updated")
          : u.kind === "STUCK"
            ? `No change from USCIS in ${u.stuckDays?.toLocaleString("en-US") ?? "many"} days`
            : d
              ? `${DEADLINE_KINDS[d.kind].label}: ${formatDue(d.dueOn)}`
              : "Deadline";
        const nextStep = u.event
          ? nextStepFor(u.event.statusTitleEn, u.event.formType ?? u.case.formType).en
          : u.kind === "STUCK"
            ? "Review the case. If it's outside normal processing time, consider an inquiry with USCIS."
            : d
              ? d.doneAt
                ? "Deadline marked done."
                : `${dueText(d.dueOn, today).replace(/^./, (c) => c.toUpperCase())}${d.note ? ` · ${d.note}` : ""}`
              : "";
        return {
          ...u,
          case: caseView,
          title,
          overdue,
          at: u.event?.firstObservedAt ?? u.createdAt,
          snoozedActive: u.state === "SNOOZED" && Boolean(u.snoozedUntil && u.snoozedUntil > t),
          client: client ? { id: client.id, displayName: client.displayName } : null,
          nextStep,
          preview: preview && { to: preview.to, subject: preview.subject, body: preview.body },
        };
      }),
    };
  }

  /** How many changes are waiting (the badge on the firm's navigation). */
  async function openCount(firmId: string, userId: string) {
    return db.firmUpdate.count({ where: tabWhere(firmId, "open", userId, now()) });
  }

  /** One inbox action. `code` names the outcome, for the page's message. */
  async function act(userId: string, updateId: string, action: UpdateAction): Promise<{ ok: true; code: string; message?: string } | (Fail & { code: string })> {
    const no = (code: string, error: string) => ({ ...fail(error), code });
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return no("no_firm", "You're not part of a firm workspace.");
    const u = await db.firmUpdate.findFirst({ where: { id: updateId, firmId: ctx.firm.id }, select: { id: true, caseId: true, clientUpdate: true } });
    if (!u) return no("not_found", "That update isn't in your inbox.");
    const log = (a: string, metadata?: object) => audit(ctx.firm.id, userId, a, "TrackedCase", u.caseId, metadata);

    switch (action.type) {
      case "assign": {
        let name: string | null = null;
        if (action.assigneeId) {
          const m = await db.firmMembership.findFirst({ where: { firmId: ctx.firm.id, userId: action.assigneeId, revokedAt: null }, select: { user: { select: { name: true, email: true } } } });
          if (!m) return no("bad_assignee", "Choose someone on your team.");
          name = m.user.name ?? m.user.email;
        }
        await db.firmUpdate.update({ where: { id: u.id }, data: { assignedToId: action.assigneeId } });
        await log(action.assigneeId ? "update.assigned" : "update.unassigned", name ? { to: name } : undefined);
        return { ok: true, code: name ? "assigned" : "unassigned", message: name ? `Assigned to ${name}.` : "Unassigned." };
      }
      case "snooze": {
        if (!(SNOOZE_DAYS as readonly number[]).includes(action.days)) return no("invalid", "Choose how long to snooze.");
        await db.firmUpdate.update({ where: { id: u.id }, data: { state: "SNOOZED", snoozedUntil: new Date(now().getTime() + action.days * 86_400_000) } });
        await log("update.snoozed", { days: action.days });
        return { ok: true, code: "snoozed", message: `Snoozed for ${action.days} ${action.days === 1 ? "day" : "days"}.` };
      }
      case "resolve":
        await db.firmUpdate.update({ where: { id: u.id }, data: { state: "DONE", resolvedById: userId, resolvedAt: now(), snoozedUntil: null } });
        await log("update.resolved");
        return { ok: true, code: "resolved", message: "Marked done." };
      case "reopen":
        await db.firmUpdate.update({ where: { id: u.id }, data: { state: "OPEN", resolvedById: null, resolvedAt: null, snoozedUntil: null } });
        await log("update.reopened");
        return { ok: true, code: "reopened", message: "Back in Open." };
      case "send": {
        if (u.clientUpdate !== "PENDING" && u.clientUpdate !== "FAILED") return no("nothing_waiting", "There's no client email waiting for this change.");
        const r = await sendClientUpdate(u.id, userId);
        if (r === "SENT") return { ok: true, code: "sent", message: "Sent to the client." };
        if (r === "NO_CLIENT") return no("no_client", "The client has no email address or agreement on file any more, so nothing was sent.");
        return no("send_failed", "The email couldn't be sent. Try again in a moment.");
      }
      case "skip": {
        const { count } = await db.firmUpdate.updateMany({ where: { id: u.id, clientUpdate: { in: ["PENDING", "FAILED"] } }, data: { clientUpdate: "SKIPPED", clientUpdateAt: now(), clientUpdateById: userId } });
        if (count === 0) return no("nothing_waiting", "There's no client email waiting for this change.");
        await log("client_update.skipped");
        return { ok: true, code: "skipped", message: "The client won't be emailed about this change." };
      }
    }
  }

  // ---- Client update settings (Owners and Admins) ------------------------------------------

  async function managerContext(userId: string): Promise<FirmContext | null> {
    const ctx = await findFirmContext(db, userId);
    return ctx && ctx.membership.role !== "STAFF" ? ctx : null;
  }

  async function saveSettings(userId: string, input: { mode: string; replyToEmail?: string | null; contactLine?: string | null }): Promise<{ ok: true } | Fail> {
    const ctx = await managerContext(userId);
    if (!ctx) return fail("Only an Owner or Admin can change client updates.");
    if (!(input.mode in CLIENT_UPDATE_MODES)) return fail("Choose how clients hear about changes.", "mode");
    const replyToEmail = input.replyToEmail?.trim().toLowerCase() || null;
    if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) return fail("Enter a valid email address, or leave it blank.", "replyToEmail");
    const contactLine = input.contactLine?.trim().replace(/\s+/g, " ") || null;
    if (contactLine && contactLine.length > 120) return fail("Use 120 characters or fewer.", "contactLine");
    const mode = input.mode as ClientUpdateMode;
    await db.firm.update({ where: { id: ctx.firm.id }, data: { clientUpdates: mode, replyToEmail, clientContactLine: contactLine } });
    if (mode !== ctx.firm.clientUpdates) await audit(ctx.firm.id, userId, "firm.client_updates", "Firm", ctx.firm.id, { from: ctx.firm.clientUpdates, to: mode });
    return { ok: true };
  }

  /** A sample of the client email in both languages, for the settings page. */
  function sampleEmails(firm: FirmForUpdate) {
    // USCIS's own Spanish title comes with real updates; the sample uses the English one.
    const event = { statusTitleEn: "Interview Was Scheduled", statusTitleEs: null, formType: "N-400" };
    const client = (locale: string) => ({ id: "sample", displayName: locale === "es" ? "María García" : "Maria Garcia", email: "client@example.com", locale, updatesConsentAt: new Date(0), archivedAt: null, portalEnabled: false, portalVersion: 1 });
    return { en: buildClientUpdate(firm, client("en"), { receiptMasked: "IOE*******123", formType: "N-400" }, event), es: buildClientUpdate(firm, client("es"), { receiptMasked: "IOE*******123", formType: "N-400" }, event) };
  }

  // ---- Client status page links (any member) -------------------------------------------------

  async function setPortal(userId: string, clientId: string, action: "on" | "off" | "new"): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const c = await db.client.findFirst({ where: { id: clientId, firmId: ctx.firm.id }, select: { id: true } });
    if (!c) return fail("Client not found.");
    // Turning the page off also changes the version, so turning it back on gives a new link.
    const data = action === "on" ? { portalEnabled: true } : action === "off" ? { portalEnabled: false, portalVersion: { increment: 1 } } : { portalVersion: { increment: 1 } };
    await db.client.update({ where: { id: c.id }, data });
    await audit(ctx.firm.id, userId, action === "on" ? "client.portal_on" : action === "off" ? "client.portal_off" : "client.portal_new_link", "Client", c.id);
    return { ok: true };
  }

  const portalUrl = (client: { id: string; portalEnabled: boolean; portalVersion: number }) => (client.portalEnabled ? `${siteUrl}${portalPath(client.id, client.portalVersion)}` : null);

  // ---- The client's status page (public, by link) ------------------------------------------------

  async function portalView(token: string) {
    const t = readPortalToken(token);
    if (!t) return null;
    const client = await db.client.findFirst({
      where: { id: t.clientId, portalEnabled: true, portalVersion: t.version, archivedAt: null, firm: { status: "ACTIVE" } },
      select: { id: true, firmId: true, displayName: true, locale: true, firm: { select: { name: true, clientContactLine: true, replyToEmail: true } } },
    });
    if (!client) return null;
    const cases = await db.trackedCase.findMany({
      where: { clientId: client.id, firmId: client.firmId },
      select: { ...caseViewSelect, events: { select: { statusTitleEn: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    const at = now();
    return {
      firm: client.firm,
      client: { displayName: client.displayName, locale: client.locale === "es" ? ("es" as const) : ("en" as const) },
      // No USCIS descriptions here (they can repeat case details); titles, plain-language help and the line map only.
      cases: cases.map((c) => {
        const journey = caseJourney(c, at);
        const guide = findStatusGuide(c.statusTitleEn);
        return {
          id: c.id,
          receiptMasked: c.receiptMasked,
          form: formInfo(c.formType),
          statusTitleEn: c.statusTitleEn,
          statusTitleEs: c.statusTitleEs,
          lineMap: journey.lineMap,
          days: journey.days,
          lastCheckedAt: c.lastCheckedAt,
          guide: guide ? { en: guideText(guide, "en"), es: guideText(guide, "es") } : null,
          nextStep: nextStepFor(c.statusTitleEn, c.formType),
        };
      }),
    };
  }

  return { recordStatusChange, sendClientUpdate, list, openCount, act, saveSettings, sampleEmails, setPortal, portalUrl, portalView };
}

export type FirmUpdateService = ReturnType<typeof createFirmUpdateService>;
