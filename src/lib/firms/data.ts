import type { PrismaClient } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import type { FileStore } from "@/lib/storage/file-store";
import { findFirmContext } from "./service";

/**
 * Legal and data (Owner only): export everything the firm has in CasePingo, and delete the whole
 * workspace. Deletion is a request with a 14-day grace period (an Owner can cancel it); the daily job
 * then deletes the firm, its clients, cases, documents (files too), tasks, requests and logs.
 */

export const DELETION_GRACE_DAYS = 14;
const DAY = 86_400_000;
const EXPORT_AUDIT_ROWS = 5000;

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });
const open = (v: string | null) => {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
};

export function createFirmDataService({ db, store, now = () => new Date() }: { db: PrismaClient; store: FileStore | null; now?: () => Date }) {
  async function owner(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return { error: fail("You're not part of a firm workspace.") };
    if (ctx.membership.role !== "OWNER") return { error: fail("Only an Owner can do this.") };
    return { ctx };
  }

  /** The pending deletion for a firm, if any (for banners and the Legal page). */
  async function pendingDeletion(firmId: string) {
    const r = await db.deletionRequest.findFirst({ where: { firmId, scope: "FIRM", status: "REQUESTED" }, orderBy: { requestedAt: "desc" }, select: { id: true, requestedAt: true, requesterEmail: true } });
    return r ? { ...r, deleteAfter: new Date(r.requestedAt.getTime() + DELETION_GRACE_DAYS * DAY) } : null;
  }

  /** Everything in one JSON file: settings, team, clients (date of birth and A-Number readable), cases with history, deadlines, tasks, matters, documents (list), requests, activity. */
  async function exportAll(userId: string): Promise<{ ok: true; json: string; filename: string } | Fail> {
    const r = await owner(userId);
    if ("error" in r) return r.error!;
    const firmId = r.ctx.firm.id;
    const [firm, members, clients, cases, deadlines, tasks, matters, tags, documents, requests, updates, audit] = await Promise.all([
      db.firm.findUniqueOrThrow({ where: { id: firmId }, select: { id: true, name: true, timeZone: true, plan: true, clientUpdates: true, replyToEmail: true, clientContactLine: true, stuckAfterDays: true, deadlineLeadDays: true, createdAt: true } }),
      db.firmMembership.findMany({ where: { firmId }, select: { role: true, title: true, createdAt: true, revokedAt: true, lastActiveAt: true, user: { select: { id: true, name: true, email: true } } } }),
      db.client.findMany({ where: { firmId }, orderBy: { createdAt: "asc" } }),
      db.trackedCase.findMany({
        where: { firmId },
        select: {
          id: true,
          receiptEncrypted: true,
          receiptMasked: true,
          nickname: true,
          formType: true,
          clientId: true,
          assigneeId: true,
          matterId: true,
          trackingStatus: true,
          statusTitleEn: true,
          lastCheckedAt: true,
          createdAt: true,
          events: { select: { statusTitleEn: true, statusTitleEs: true, formType: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } },
          consents: { select: { basis: true, source: true, evidenceRef: true, capturedAt: true, withdrawnAt: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.caseDeadline.findMany({ where: { firmId }, select: { caseId: true, kind: true, dueOn: true, note: true, doneAt: true, createdAt: true } }),
      db.firmTask.findMany({ where: { firmId }, include: { comments: { select: { body: true, authorId: true, createdAt: true } } } }),
      db.firmMatter.findMany({ where: { firmId } }),
      db.firmTag.findMany({ where: { firmId }, select: { id: true, name: true, color: true } }),
      db.firmDocument.findMany({ where: { firmId }, select: { id: true, name: true, kind: true, visibility: true, source: true, contentType: true, size: true, caseId: true, clientId: true, uploadedById: true, createdAt: true } }),
      db.documentRequest.findMany({ where: { firmId }, include: { items: { select: { label: true, labelEs: true, note: true, required: true, status: true, rejectReason: true } } } }),
      db.firmUpdate.findMany({ where: { firmId }, select: { kind: true, state: true, caseId: true, assignedToId: true, createdAt: true, resolvedAt: true } }),
      db.auditLog.findMany({ where: { firmId }, select: { action: true, actorUserId: true, targetType: true, targetId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: EXPORT_AUDIT_ROWS }),
    ]);
    const data = {
      exportedAt: now().toISOString(),
      format: "casepingo-firm-export/1",
      note: "Everything your firm has in CasePingo. Document files aren't inside this file; download them from Documents. Keep this file private: it contains clients' dates of birth, A-Numbers and full receipt numbers.",
      firm,
      members: members.map((m) => ({ ...m.user, role: m.role, title: m.title, joinedAt: m.createdAt, removedAt: m.revokedAt, lastActiveAt: m.lastActiveAt })),
      // Readable values in place of the encrypted columns.
      clients: clients.map(({ dateOfBirthEnc, aNumberEnc, ...c }) => ({ ...c, dateOfBirth: open(dateOfBirthEnc), aNumber: open(aNumberEnc) })),
      cases: cases.map(({ receiptEncrypted, ...c }) => ({ ...c, receipt: open(receiptEncrypted) })),
      deadlines,
      tasks,
      matters,
      tags,
      documents,
      documentRequests: requests,
      inbox: updates,
      activity: audit,
    };
    await db.auditLog.create({ data: { firmId, actorUserId: userId, action: "firm.exported", targetType: "Firm", targetId: firmId, metadata: { clients: clients.length, cases: cases.length } } });
    return { ok: true, json: JSON.stringify(data, null, 2), filename: `casepingo-firm-export-${now().toISOString().slice(0, 10)}.json` };
  }

  async function requestDeletion(userId: string, confirmName: string): Promise<{ ok: true } | Fail> {
    const r = await owner(userId);
    if ("error" in r) return r.error!;
    const { firm } = r.ctx;
    if (confirmName.trim() !== firm.name) return fail("Type your firm's name exactly as shown.", "confirm");
    const active = await db.subscription.findFirst({ where: { firmId: firm.id, status: { in: ["active", "trialing", "past_due", "unpaid"] } }, select: { id: true } });
    if (active) return fail("Cancel your plan in Plan & billing first, so you aren't charged again. Then come back to delete the workspace.");
    if (await pendingDeletion(firm.id)) return { ok: true };
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    await db.deletionRequest.create({ data: { requesterId: userId, requesterEmail: user.email, firmId: firm.id, scope: "FIRM", targetId: firm.id, requestedAt: now() } });
    await db.auditLog.create({ data: { firmId: firm.id, actorUserId: userId, action: "firm.deletion_requested", targetType: "Firm", targetId: firm.id } });
    return { ok: true };
  }

  async function cancelDeletion(userId: string): Promise<{ ok: true } | Fail> {
    const r = await owner(userId);
    if ("error" in r) return r.error!;
    const { count } = await db.deletionRequest.updateMany({ where: { firmId: r.ctx.firm.id, scope: "FIRM", status: "REQUESTED" }, data: { status: "REJECTED", completedAt: now(), notes: "Canceled by the firm" } });
    if (count) await db.auditLog.create({ data: { firmId: r.ctx.firm.id, actorUserId: userId, action: "firm.deletion_canceled", targetType: "Firm", targetId: r.ctx.firm.id } });
    return { ok: true };
  }

  /** Daily: delete firms whose grace period is over. Files first, then the database rows (cascade). */
  async function runDeletions(): Promise<{ deleted: number }> {
    const due = await db.deletionRequest.findMany({ where: { scope: "FIRM", status: "REQUESTED", firmId: { not: null }, requestedAt: { lte: new Date(now().getTime() - DELETION_GRACE_DAYS * DAY) } }, select: { id: true, firmId: true } });
    let deleted = 0;
    for (const d of due) {
      const firmId = d.firmId!;
      const claimed = await db.deletionRequest.updateMany({ where: { id: d.id, status: "REQUESTED" }, data: { status: "IN_PROGRESS" } });
      if (!claimed.count) continue;
      try {
        const [docs, firm] = await Promise.all([db.firmDocument.findMany({ where: { firmId }, select: { storageKey: true } }), db.firm.findUnique({ where: { id: firmId }, select: { logoKey: true } })]);
        if (store) for (const key of [...docs.map((x) => x.storageKey), ...(firm?.logoKey ? [firm.logoKey] : [])]) await store.remove(key).catch(() => {});
        await db.$transaction([db.trackedCase.deleteMany({ where: { firmId } }), db.firm.deleteMany({ where: { id: firmId } })]);
        await db.deletionRequest.update({ where: { id: d.id }, data: { status: "COMPLETED", completedAt: now(), notes: `Deleted ${docs.length} files` } });
        deleted++;
      } catch (err) {
        await db.deletionRequest.update({ where: { id: d.id }, data: { status: "REQUESTED", notes: `Retry: ${(err as Error).message.slice(0, 200)}` } });
      }
    }
    return { deleted };
  }

  return { pendingDeletion, exportAll, requestDeletion, cancelDeletion, runDeletions };
}
