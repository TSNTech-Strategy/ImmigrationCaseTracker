import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { documentRequestEmail } from "@/lib/email/templates";
import { sign } from "@/lib/crypto";
import { checklistForForm, checklistItems } from "@/lib/checklists";
import { findFirmContext } from "./service";
import type { FirmDocumentService } from "./documents";
import { easternDay, formatDue } from "./alerts";

/**
 * Document requests: the firm lists the documents it needs from a client (from the case type's checklist,
 * or its own items), the client opens a private link (no account) and uploads each one from a phone,
 * and the firm accepts each upload or asks again with a reason.
 *
 * - The link is signed (request id + version); "new link" or cancelling makes old links stop working.
 * - Client uploads become firm documents (shared with the client), checked and encrypted like any upload,
 *   and each upload puts an item in the firm's Inbox. When every required item is accepted, the request is complete.
 * - Emails (request, "upload again", reminders 2 days before and the day after the due date) go to the client's
 *   address in their language, from "{Firm} via CasePingo" with the firm's reply-to.
 */

const PURPOSE = "ict/doc-request/v1";
const MAX_ITEMS = 40;
const MAX_FILES_PER_ITEM = 10;
const MAX_FILES_PER_REQUEST = 60;
const DAY = 86_400_000;

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export function requestToken(id: string, version: number) {
  const body = Buffer.from(`${id}.${version}`).toString("base64url");
  return `${body}.${sign(PURPOSE, `${id}.${version}`)}`;
}
export function readRequestToken(token: string): { id: string; version: number } | null {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined || body.length > 120) return null;
  const decoded = Buffer.from(body, "base64url").toString("utf8");
  const m = /^([a-z0-9]{10,40})\.(\d{1,6})$/.exec(decoded);
  if (!m) return null;
  const expected = Buffer.from(sign(PURPOSE, decoded));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  return { id: m[1]!, version: Number(m[2]) };
}

export type RequestItemInput = { label: string; labelEs?: string | null; note?: string | null; required?: boolean };
export type RequestInput = { clientId: string; caseId?: string | null; title: string; message?: string | null; dueOn?: string | null; items: RequestItemInput[] };

/** The checklist for a case's form, as request items (English and Spanish labels). */
export function itemsFromChecklist(formType: string | null | undefined): RequestItemInput[] {
  const list = checklistForForm(formType);
  if (!list) return [];
  return checklistItems(list).map((i) => ({ label: i.title.en, labelEs: i.title.es, note: i.detail?.en ?? null, required: i.required }));
}

export function createDocumentRequestService({ db, mailer, siteUrl, docs, now = () => new Date() }: { db: PrismaClient; mailer: EmailDriver; siteUrl: string; docs: FirmDocumentService; now?: () => Date }) {
  async function audit(firmId: string, actorUserId: string | null, action: string, targetId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType: "DocumentRequest", targetId, metadata: metadata ?? undefined } });
  }
  const linkFor = (r: { id: string; linkVersion: number }) => `${siteUrl}/upload/${requestToken(r.id, r.linkVersion)}`;

  async function create(userId: string, input: RequestInput): Promise<{ ok: true; id: string } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const client = await db.client.findFirst({ where: { id: input.clientId, firmId: ctx.firm.id, archivedAt: null }, select: { id: true } });
    if (!client) return fail("Choose one of your firm's clients.", "clientId");
    let caseId = input.caseId || null;
    if (caseId) {
      const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id, clientId: client.id }, select: { id: true } });
      if (!c) return fail("Choose one of this client's cases.", "caseId");
      caseId = c.id;
    }
    const title = input.title.trim().replace(/\s+/g, " ");
    if (title.length < 2 || title.length > 120) return fail("Give the request a title (2 to 120 characters).", "title");
    const message = input.message?.trim() || null;
    if (message && message.length > 1000) return fail("Use 1,000 characters or fewer.", "message");
    let dueOn: Date | null = null;
    if (input.dueOn) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || new Date(`${input.dueOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.dueOn) return fail("Enter the date, like 2026-12-01.", "dueOn");
      dueOn = new Date(`${input.dueOn}T00:00:00Z`);
    }
    const items = input.items
      .map((i) => ({ label: i.label.trim().replace(/\s+/g, " ").slice(0, 160), labelEs: i.labelEs?.trim().slice(0, 160) || null, note: i.note?.trim().slice(0, 300) || null, required: i.required !== false }))
      .filter((i) => i.label.length > 0);
    if (!items.length) return fail("Add at least one document to request.", "items");
    if (items.length > MAX_ITEMS) return fail(`Request up to ${MAX_ITEMS} documents at a time.`, "items");
    const r = await db.documentRequest.create({
      data: { firmId: ctx.firm.id, clientId: client.id, caseId, title, message, dueOn, createdById: userId, items: { create: items.map((i, position) => ({ ...i, position })) } },
      select: { id: true },
    });
    await audit(ctx.firm.id, userId, "request.created", r.id, { title, items: items.length });
    return { ok: true, id: r.id };
  }

  async function own(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const r = await db.documentRequest.findFirst({ where: { id, firmId: ctx.firm.id }, include: { client: true, items: { orderBy: { position: "asc" } } } });
    return r ? { ctx, r } : null;
  }

  async function email(r: { id: string; linkVersion: number; title: string; message: string | null; dueOn: Date | null; firmId: string }, client: { email: string | null; locale: string; displayName: string; firstName: string | null }, kind: "request" | "reminder" | "reupload", items: { label: string; labelEs: string | null }[], reason?: string | null) {
    if (!client.email) return false;
    const firm = await db.firm.findUniqueOrThrow({ where: { id: r.firmId }, select: { name: true, clientContactLine: true, replyToEmail: true, timeZone: true } });
    const es = client.locale === "es";
    const due = r.dueOn ? new Intl.DateTimeFormat(es ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(r.dueOn) : null;
    await mailer.send(
      documentRequestEmail({
        to: client.email,
        locale: client.locale,
        firmName: firm.name,
        clientName: client.firstName ?? client.displayName,
        kind,
        title: r.title,
        message: r.message,
        items: items.map((i) => (es && i.labelEs ? i.labelEs : i.label)),
        dueText: due,
        link: linkFor(r),
        reason,
        contactLine: firm.clientContactLine,
        replyTo: firm.replyToEmail,
      }),
    );
    return true;
  }

  /** Email the link to the client. */
  async function send(userId: string, id: string): Promise<{ ok: true } | Fail> {
    const o = await own(userId, id);
    if (!o) return fail("Request not found.");
    const { ctx, r } = o;
    if (r.status !== "OPEN") return fail("This request isn't open.");
    if (!r.client.email) return fail("Add the client's email address first, or copy the link and send it yourself.");
    await email(r, r.client, "request", r.items.filter((i) => i.status !== "ACCEPTED"));
    await db.documentRequest.update({ where: { id: r.id }, data: { sentAt: now() } });
    await audit(ctx.firm.id, userId, "request.sent", r.id, { title: r.title });
    return { ok: true };
  }

  async function newLink(userId: string, id: string): Promise<{ ok: true } | Fail> {
    const o = await own(userId, id);
    if (!o) return fail("Request not found.");
    await db.documentRequest.update({ where: { id }, data: { linkVersion: { increment: 1 } } });
    await audit(o.ctx.firm.id, userId, "request.new_link", id, { title: o.r.title });
    return { ok: true };
  }

  async function setCanceled(userId: string, id: string, canceled: boolean): Promise<{ ok: true } | Fail> {
    const o = await own(userId, id);
    if (!o) return fail("Request not found.");
    if (canceled && o.r.status !== "OPEN") return fail("Only open requests can be canceled.");
    if (!canceled && o.r.status !== "CANCELED") return { ok: true };
    await db.documentRequest.update({ where: { id }, data: canceled ? { status: "CANCELED", linkVersion: { increment: 1 } } : { status: "OPEN" } });
    if (canceled) await db.firmUpdate.updateMany({ where: { requestId: id, state: { not: "DONE" } }, data: { state: "DONE", resolvedAt: now(), resolvedById: userId } });
    await audit(o.ctx.firm.id, userId, canceled ? "request.canceled" : "request.reopened", id, { title: o.r.title });
    return { ok: true };
  }

  /** Accept an upload, or ask the client again with a reason (they get an email). Completes the request when every required item is accepted. */
  async function review(userId: string, itemId: string, decision: "accept" | "reject", reasonInput?: string): Promise<{ ok: true; completed: boolean } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const item = await db.documentRequestItem.findFirst({ where: { id: itemId, request: { firmId: ctx.firm.id } }, include: { request: { include: { client: true, items: true } } } });
    if (!item) return fail("Item not found.");
    if (item.request.status === "CANCELED") return fail("This request was canceled.");
    const reason = reasonInput?.trim().slice(0, 300) || null;
    if (decision === "reject" && !reason) return fail("Say what's wrong so the client knows what to upload.", "reason");
    const t = now();
    await db.documentRequestItem.update({ where: { id: item.id }, data: decision === "accept" ? { status: "ACCEPTED", rejectReason: null, reviewedById: userId, reviewedAt: t } : { status: "REJECTED", rejectReason: reason, reviewedById: userId, reviewedAt: t } });
    const items = item.request.items.map((i) => (i.id === item.id ? { ...i, status: decision === "accept" ? ("ACCEPTED" as const) : ("REJECTED" as const) } : i));
    const completed = decision === "accept" && items.filter((i) => i.required).every((i) => i.status === "ACCEPTED");
    if (completed) {
      await db.documentRequest.update({ where: { id: item.requestId }, data: { status: "COMPLETED", completedAt: t } });
      await db.firmUpdate.updateMany({ where: { requestId: item.requestId, state: { not: "DONE" } }, data: { state: "DONE", resolvedAt: t, resolvedById: userId } });
    } else if (item.request.status === "COMPLETED") {
      await db.documentRequest.update({ where: { id: item.requestId }, data: { status: "OPEN", completedAt: null } });
    }
    if (decision === "reject") await email(item.request, item.request.client, "reupload", [item], reason);
    await audit(ctx.firm.id, userId, decision === "accept" ? "request.item_accepted" : "request.item_rejected", item.requestId, { title: item.request.title, item: item.label });
    return { ok: true, completed };
  }

  async function get(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const r = await db.documentRequest.findFirst({
      where: { id, firmId: ctx.firm.id },
      include: {
        client: { select: { id: true, displayName: true, email: true, locale: true } },
        case: { select: { id: true, receiptMasked: true, nickname: true, formType: true } },
        createdBy: { select: { name: true, email: true } },
        items: {
          orderBy: { position: "asc" },
          include: { reviewedBy: { select: { name: true, email: true } }, documents: { select: { id: true, name: true, size: true, contentType: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
        },
      },
    });
    return r ? { ctx, request: r, link: linkFor(r) } : null;
  }

  async function list(userId: string, filters: { status?: "OPEN" | "COMPLETED" | "CANCELED" | "all"; clientId?: string; caseId?: string } = {}) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const status = filters.status ?? "OPEN";
    const requests = await db.documentRequest.findMany({
      where: { firmId: ctx.firm.id, ...(status !== "all" ? { status } : {}), ...(filters.clientId ? { clientId: filters.clientId } : {}), ...(filters.caseId ? { caseId: filters.caseId } : {}) },
      select: {
        id: true,
        title: true,
        status: true,
        dueOn: true,
        sentAt: true,
        createdAt: true,
        client: { select: { id: true, displayName: true } },
        case: { select: { id: true, receiptMasked: true, nickname: true } },
        items: { select: { status: true, required: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const today = easternDay(now(), ctx.firm.timeZone);
    return { ctx, today, requests: requests.map((r) => ({ ...r, progress: progressOf(r.items) })) };
  }

  // ---- The client's side (public, by link) ------------------------------------------------------

  async function fromToken(token: string) {
    const t = readRequestToken(token);
    if (!t) return null;
    const r = await db.documentRequest.findFirst({
      where: { id: t.id, linkVersion: t.version, status: { in: ["OPEN", "COMPLETED"] }, firm: { status: "ACTIVE" } },
      include: {
        firm: { select: { name: true, clientContactLine: true, replyToEmail: true } },
        client: { select: { id: true, displayName: true, firstName: true, locale: true } },
        items: { orderBy: { position: "asc" }, include: { documents: { select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "asc" } } } },
      },
    });
    return r;
  }

  async function publicView(token: string) {
    const r = await fromToken(token);
    if (!r) return null;
    return {
      firm: r.firm,
      client: { name: r.client.firstName ?? r.client.displayName, locale: r.client.locale === "es" ? ("es" as const) : ("en" as const) },
      title: r.title,
      message: r.message,
      dueOn: r.dueOn,
      status: r.status,
      progress: progressOf(r.items),
      items: r.items.map((i) => ({ id: i.id, label: i.label, labelEs: i.labelEs, note: i.note, required: i.required, status: i.status, rejectReason: i.rejectReason, files: i.documents.map((d) => ({ name: d.name, at: d.createdAt })) })),
    };
  }

  async function uploadFromClient(token: string, itemId: string, file: { data: Buffer; name: string }): Promise<{ ok: true; name: string } | Fail> {
    const r = await fromToken(token);
    if (!r) return fail("This link no longer works. Ask your law firm for a new one.");
    if (r.status !== "OPEN") return fail("This request is complete. Thank you!");
    const item = r.items.find((i) => i.id === itemId);
    if (!item) return fail("Choose a document from the list.");
    if (item.status === "ACCEPTED") return fail("Your law firm already accepted this document.");
    if (item.documents.length >= MAX_FILES_PER_ITEM) return fail(`You can upload up to ${MAX_FILES_PER_ITEM} files for one document. Contact your law firm if you need more.`);
    if (r.items.reduce((s, i) => s + i.documents.length, 0) >= MAX_FILES_PER_REQUEST) return fail("This request already has many files. Contact your law firm.");
    const saved = await docs.saveFromClient(r.firmId, { data: file.data, name: file.name, caseId: r.caseId, clientId: r.clientId, requestItemId: item.id });
    if (!saved.ok) return saved;
    await db.documentRequestItem.update({ where: { id: item.id }, data: { status: "UPLOADED", rejectReason: null } });
    // The firm's Inbox: to the case's assignee, else whoever made the request.
    const c = r.caseId ? await db.trackedCase.findUnique({ where: { id: r.caseId }, select: { assigneeId: true } }) : null;
    await db.firmUpdate.create({ data: { firmId: r.firmId, caseId: r.caseId, kind: "DOCUMENT", requestId: r.id, alertKey: `request:${r.id}:upload:${saved.id}`, assignedToId: c?.assigneeId ?? r.createdById } });
    await audit(r.firmId, null, "request.client_uploaded", r.id, { title: r.title, item: item.label, file: saved.name });
    return { ok: true, name: saved.name };
  }

  // ---- Reminders (daily job) ----------------------------------------------------------------------

  /** Two days before the due date, and the day after it, for open requests that were emailed. At most two reminders. */
  async function runReminders() {
    const t = now();
    const open = await db.documentRequest.findMany({
      where: { status: "OPEN", sentAt: { not: null }, dueOn: { not: null }, remindersSent: { lt: 2 }, firm: { status: "ACTIVE" }, client: { email: { not: null }, archivedAt: null } },
      include: { client: true, firm: { select: { timeZone: true } }, items: { orderBy: { position: "asc" } } },
    });
    let sent = 0;
    for (const r of open) {
      const today = new Date(`${easternDay(t, r.firm.timeZone)}T00:00:00Z`);
      const days = Math.round((r.dueOn!.getTime() - today.getTime()) / DAY);
      const due = (r.remindersSent === 0 && days <= 2) || (r.remindersSent === 1 && days < 0);
      if (!due || (r.lastReminderAt && t.getTime() - r.lastReminderAt.getTime() < DAY)) continue;
      const missing = r.items.filter((i) => i.status === "PENDING" || i.status === "REJECTED");
      if (!missing.length) continue;
      await email(r, r.client, "reminder", missing);
      await db.documentRequest.update({ where: { id: r.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: t } });
      sent++;
    }
    return { sent };
  }

  return { create, send, newLink, setCanceled, review, get, list, publicView, uploadFromClient, runReminders, linkFor };
}

export function progressOf(items: { status: string; required: boolean }[]) {
  const required = items.filter((i) => i.required);
  return {
    total: items.length,
    required: required.length,
    accepted: items.filter((i) => i.status === "ACCEPTED").length,
    uploaded: items.filter((i) => i.status === "UPLOADED").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
    requiredAccepted: required.filter((i) => i.status === "ACCEPTED").length,
  };
}

export const REQUEST_ITEM_STATUS = {
  PENDING: { en: "Not uploaded yet", es: "Aún no se ha subido" },
  UPLOADED: { en: "Uploaded, waiting for review", es: "Subido, en revisión" },
  ACCEPTED: { en: "Accepted", es: "Aceptado" },
  REJECTED: { en: "Please upload again", es: "Por favor, súbalo de nuevo" },
} as const;

export { formatDue };

export type DocumentRequestService = ReturnType<typeof createDocumentRequestService>;
