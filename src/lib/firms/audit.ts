import { DEADLINE_KINDS } from "./alerts";
import type { Prisma, PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/csv";
import { ROLE_LABELS } from "./roles";
import { firmConsentLabel } from "./consent";
import { findFirmContext } from "./service";

/**
 * The firm's activity log (who changed what, when), for Owners and Admins.
 *
 * - Read-only: entries are written by the services as things happen and are
 *   never edited or deleted from the app.
 * - Scoped to the caller's firm, read fresh from the database.
 * - Descriptions are built from the stored minimal metadata. Receipt numbers
 *   only ever appear masked, and client contact details are never logged.
 * - Exporting is itself recorded in the log.
 */

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX = 10_000;

export const AUDIT_CATEGORIES = {
  team: { label: "Team and invitations", prefixes: ["firm.", "invite.", "member."] },
  clients: { label: "Clients", prefixes: ["client."] },
  cases: { label: "Cases and consent", prefixes: ["case.", "cases.", "consent."] },
  tags: { label: "Tags", prefixes: ["tag."] },
  updates: { label: "Updates, deadlines and client emails", prefixes: ["update.", "client_update.", "client.portal_", "firm.client_updates", "deadline.", "firm.alerts"] },
  tasks: { label: "Tasks", prefixes: ["task."] },
  exports: { label: "Exports", prefixes: ["audit."] },
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

export type AuditFilters = { category?: AuditCategory; actorId?: string; from?: Date; to?: Date; before?: string };

type Meta = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const role = (v: unknown) => ROLE_LABELS[v as keyof typeof ROLE_LABELS] ?? str(v);
const plural = (n: unknown, word: string) => `${Number(n) || 0} ${word}${Number(n) === 1 ? "" : "s"}`;
const names = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []).map((n) => `"${n}"`).join(", ");
const COLOR_NAME: Record<string, string> = { blue: "blue", green: "green", amber: "amber", red: "red", purple: "purple", gray: "gray" };

const deadlineLabel = (k: unknown) => (typeof k === "string" && k in DEADLINE_KINDS ? DEADLINE_KINDS[k as keyof typeof DEADLINE_KINDS].label : "Deadline");

/** A plain-English sentence for one entry. `target` is the masked receipt, client name or member. */
export function describeAudit(action: string, m: Meta, target: string): string {
  const t = target || "an item that was later removed";
  switch (action) {
    case "firm.created":
      return "Created the firm workspace";
    case "firm.plan_changed": {
      const label = (v: unknown) => (v === "SOLO" ? "Firm Solo" : v === "FIRM" ? "Firm" : "no paid plan");
      return m.to ? `Plan changed to ${label(m.to)} (${plural(m.caseLimit, "case")})` : `Paid plan ended (was ${label(m.from)})`;
    }
    case "invite.sent":
      return `Invited ${str(m.email)} as ${role(m.role)}`;
    case "invite.revoked":
      return `Cancelled the invitation for ${t}`;
    case "invite.accepted":
      return `Accepted an invitation and joined as ${role(m.role)}`;
    case "member.role_changed":
      return `Changed ${t}'s role from ${role(m.from)} to ${role(m.to)}`;
    case "member.removed":
      return `Removed ${t} (${role(m.role)}) from the team`;
    case "member.left":
      return "Left the firm";
    case "client.created":
      return `Added client ${t}${m.source === "csv" ? " (CSV import)" : ""}`;
    case "client.updated":
      return `Updated client ${t} (${(Array.isArray(m.fields) ? m.fields : []).join(", ") || "details"})`;
    case "client.archived":
      return `Archived client ${t}`;
    case "client.restored":
      return `Restored client ${t}`;
    case "case.created":
      return `Added case ${t}${m.basis ? `: ${firmConsentLabel(m.basis as never)}` : ""}${m.source === "csv" ? " (CSV import)" : ""}`;
    case "case.removed":
      return `Removed case ${t}`;
    case "consent.withdrawn":
      return `Withdrew consent for case ${t}, so checks stopped`;
    case "consent.recorded":
      return `Recorded consent for case ${t}: ${firmConsentLabel(m.basis as never)}`;
    case "case.tags_changed": {
      const parts = [names(m.added) && `added ${names(m.added)}`, names(m.removed) && `took off ${names(m.removed)}`].filter(Boolean);
      return `Changed tags on case ${t}: ${parts.join("; ") || "no change"}`;
    }
    case "tag.created":
      return `Created tag "${str(m.name)}"${m.source === "csv" ? " (CSV import)" : ""}`;
    case "tag.updated": {
      const renamed = str(m.from) !== str(m.to);
      const recolored = str(m.fromColor) !== str(m.color);
      if (renamed && recolored) return `Renamed tag "${str(m.from)}" to "${str(m.to)}" and made it ${COLOR_NAME[str(m.color)] ?? str(m.color)}`;
      if (renamed) return `Renamed tag "${str(m.from)}" to "${str(m.to)}"`;
      return `Made tag "${str(m.to)}" ${COLOR_NAME[str(m.color)] ?? str(m.color)}`;
    }
    case "tag.deleted":
      return `Deleted tag "${str(m.name)}"${Number(m.cases) ? ` (it came off ${plural(m.cases, "case")})` : ""}`;
    case "cases.imported":
      return `Imported ${plural(m.added, "case")} from CSV (${plural(m.newClients, "new client")}${Number(m.newTags) ? `, ${plural(m.newTags, "new tag")}` : ""}, ${plural(m.skipped, "row")} skipped)`;
    case "update.assigned":
      return `Assigned the update on case ${t} to ${str(m.to) || "a team member"}`;
    case "update.unassigned":
      return `Unassigned the update on case ${t}`;
    case "update.snoozed":
      return `Snoozed the update on case ${t} for ${plural(m.days, "day")}`;
    case "update.resolved":
      return `Marked the update on case ${t} done`;
    case "update.reopened":
      return `Reopened the update on case ${t}`;
    case "client_update.sent":
      return `${m.automatic ? "Automatically emailed" : "Emailed"} the client about case ${t}${m.language === "es" ? " (Spanish)" : ""}`;
    case "client_update.skipped":
      return `Chose not to email the client about case ${t}`;
    case "client.portal_on":
      return `Turned on the status page link for client ${t}`;
    case "client.portal_off":
      return `Turned off the status page link for client ${t}`;
    case "client.portal_new_link":
      return `Made a new status page link for client ${t} (the old one stopped working)`;
    case "firm.client_updates": {
      const label = (v: unknown) => (v === "AUTO" ? "Automatic" : v === "REVIEW" ? "Review first" : "Off");
      return `Changed client emails from ${label(m.from)} to ${label(m.to)}`;
    }
    case "case.assigned":
      return `Assigned case ${t} to ${str(m.to) || "nobody"}`;
    case "cases.exported":
      return `Exported ${plural(m.rows, "case")} to CSV (with full receipt numbers)`;
    case "firm.settings":
      return `Changed firm settings (${(Array.isArray(m.fields) ? m.fields : []).join(", ") || "details"})`;
    case "task.created":
      return `Created task "${str(m.title)}"`;
    case "task.updated":
      return `Changed task "${str(m.title)}" (${(Array.isArray(m.fields) ? m.fields : []).join(", ") || "details"})`;
    case "task.completed":
      return `Completed task "${str(m.title)}"`;
    case "task.reopened":
      return `Reopened task "${str(m.title)}"`;
    case "task.deleted":
      return `Deleted task "${str(m.title)}"`;
    case "task.commented":
      return `Commented on task "${str(m.title)}"${Number(m.mentions) ? ` and mentioned ${plural(m.mentions, "teammate")}` : ""}`;
    case "deadline.added":
      return `Added a deadline on case ${t}: ${deadlineLabel(m.kind)} ${str(m.dueOn)}`;
    case "deadline.done":
      return `Marked a deadline on case ${t} done: ${deadlineLabel(m.kind)} ${str(m.dueOn)}`;
    case "deadline.reopened":
      return `Reopened a deadline on case ${t}: ${deadlineLabel(m.kind)} ${str(m.dueOn)}`;
    case "deadline.removed":
      return `Removed a deadline on case ${t}: ${deadlineLabel(m.kind)} ${str(m.dueOn)}`;
    case "firm.alerts": {
      const to = (m.to ?? {}) as { stuckAfterDays?: number; deadlineLeadDays?: number };
      return `Changed team alerts: stuck after ${to.stuckAfterDays ? `${to.stuckAfterDays} days` : "never"}, deadline reminders ${to.deadlineLeadDays ?? "?"} days before`;
    }
    case "audit.exported":
      return `Exported the activity log (${Number(m.rows) || 0} ${Number(m.rows) === 1 ? "entry" : "entries"})`;
    default:
      return action;
  }
}

export function createFirmAuditService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function managerContext(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx || ctx.membership.role === "STAFF") return null;
    return ctx;
  }

  function where(firmId: string, f: AuditFilters): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [{ firmId }];
    if (f.category) and.push({ OR: AUDIT_CATEGORIES[f.category].prefixes.map((p) => ({ action: { startsWith: p } })) });
    if (f.actorId) and.push({ actorUserId: f.actorId });
    if (f.from) and.push({ createdAt: { gte: f.from } });
    if (f.to) and.push({ createdAt: { lt: f.to } });
    return { AND: and };
  }

  /** Readable names for the targets of a batch of entries (one query per type). */
  async function targetNames(firmId: string, rows: { targetType: string; targetId: string }[]) {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.targetType === type).map((r) => r.targetId))];
    const [cases, clients, members, invites] = await Promise.all([
      db.trackedCase.findMany({ where: { firmId, id: { in: ids("TrackedCase") } }, select: { id: true, receiptMasked: true, nickname: true } }),
      db.client.findMany({ where: { firmId, id: { in: ids("Client") } }, select: { id: true, displayName: true } }),
      db.firmMembership.findMany({ where: { firmId, id: { in: ids("FirmMembership") } }, select: { id: true, user: { select: { name: true, email: true } } } }),
      db.firmInvitation.findMany({ where: { firmId, id: { in: ids("FirmInvitation") } }, select: { id: true, email: true } }),
    ]);
    const names = new Map<string, { label: string; href?: string }>();
    for (const c of cases) names.set(c.id, { label: c.nickname ? `${c.receiptMasked} (${c.nickname})` : c.receiptMasked, href: `/firm/cases/${c.id}` });
    for (const c of clients) names.set(c.id, { label: c.displayName, href: `/firm/clients/${c.id}` });
    for (const m of members) names.set(m.id, { label: m.user.name ?? m.user.email });
    for (const i of invites) names.set(i.id, { label: i.email });
    return names;
  }

  async function decorate(firmId: string, rows: Prisma.AuditLogGetPayload<{ include: { actor: { select: { name: true; email: true } } } }>[]) {
    const names = await targetNames(firmId, rows);
    return rows.map((r) => {
      const target = r.targetType === "Firm" ? undefined : names.get(r.targetId);
      return {
        id: r.id,
        createdAt: r.createdAt,
        action: r.action,
        actor: r.actor ? (r.actor.name ?? r.actor.email) : r.actorUserId ? "Former user" : r.action.startsWith("client_update.") ? "CasePingo (automatic)" : "CasePingo billing",
        actorEmail: r.actor?.email ?? null,
        description: describeAudit(r.action, (r.metadata ?? {}) as Meta, target?.label ?? ""),
        href: target?.href ?? null,
      };
    });
  }

  async function list(userId: string, filters: AuditFilters = {}) {
    const ctx = await managerContext(userId);
    if (!ctx) return null;
    const w = where(ctx.firm.id, filters);
    // Cursor: entries strictly older than the last one shown (id breaks ties).
    let cursor: Prisma.AuditLogWhereInput | undefined;
    if (filters.before) {
      const ref = await db.auditLog.findFirst({ where: { id: filters.before, firmId: ctx.firm.id }, select: { id: true, createdAt: true } });
      if (ref) cursor = { OR: [{ createdAt: { lt: ref.createdAt } }, { createdAt: ref.createdAt, id: { lt: ref.id } }] };
    }
    const rows = await db.auditLog.findMany({
      where: cursor ? { AND: [w, cursor] } : w,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: AUDIT_PAGE_SIZE + 1,
    });
    const page = rows.slice(0, AUDIT_PAGE_SIZE);
    const actors = await db.firmMembership.findMany({
      where: { firmId: ctx.firm.id },
      select: { userId: true, revokedAt: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      ctx,
      entries: await decorate(ctx.firm.id, page),
      nextBefore: rows.length > AUDIT_PAGE_SIZE ? page[page.length - 1].id : null,
      actors: actors.map((a) => ({ id: a.userId, label: `${a.user.name ?? a.user.email}${a.revokedAt ? " (former)" : ""}` })),
    };
  }

  async function exportCsv(userId: string, filters: AuditFilters = {}): Promise<{ ok: true; csv: string; filename: string; rows: number } | { ok: false }> {
    const ctx = await managerContext(userId);
    if (!ctx) return { ok: false };
    const rows = await db.auditLog.findMany({
      where: where(ctx.firm.id, filters),
      include: { actor: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: AUDIT_EXPORT_MAX,
    });
    const entries = await decorate(ctx.firm.id, rows);
    const lines = [
      ["time_utc", "actor", "actor_email", "action", "description"].join(","),
      ...entries.map((e) => [e.createdAt.toISOString(), e.actor, e.actorEmail, e.action, e.description].map(csvCell).join(",")),
    ];
    await db.auditLog.create({
      data: {
        firmId: ctx.firm.id,
        actorUserId: userId,
        action: "audit.exported",
        targetType: "Firm",
        targetId: ctx.firm.id,
        metadata: { rows: entries.length, category: filters.category ?? null },
      },
    });
    const day = now().toISOString().slice(0, 10);
    return { ok: true, csv: "﻿" + lines.join("\r\n") + "\r\n", filename: `casepingo-activity-${day}.csv`, rows: entries.length };
  }

  return { list, exportCsv };
}
