import type { FirmTaskPriority, FirmTaskStatus, FirmTaskType, Prisma, PrismaClient } from "@prisma/client";
import { findFirmContext, type FirmContext } from "./service";
import { inboxOwner } from "./team";
import { easternDay } from "./alerts";

/**
 * Tasks for a firm's team: a title, optional description, status, type, priority, due date and assignee,
 * optionally about a case or a client. Comments can @mention teammates.
 *
 * Inbox items (kind TASK), each once:
 * - "assigned": someone else gave you the task;
 * - "mention": someone mentioned you in a comment;
 * - "due": due today or tomorrow; "overdue": past its due date and not done.
 * Finishing a task closes its open inbox items. Any member can create, edit and comment;
 * deleting is for the task's creator, an Owner or an Admin.
 */

export const TASK_STATUSES: Record<FirmTaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", WAITING: "Waiting on client", DONE: "Done" };
export const TASK_TYPES: Record<FirmTaskType, string> = {
  GENERAL: "General",
  CLIENT_FOLLOW_UP: "Client follow-up",
  FORM_PREP: "Form preparation",
  FILING: "Filing",
  RESPONSE: "RFE / NOID response",
  REVIEW: "Attorney review",
};
export const TASK_PRIORITIES: Record<FirmTaskPriority, string> = { NONE: "No priority", LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const PRIORITY_RANK: Record<FirmTaskPriority, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
export const ACTIVE: FirmTaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING"];

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });
const DAY = 86_400_000;
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export type TaskInput = {
  title: string;
  description?: string | null;
  status?: string;
  type?: string;
  priority?: string;
  dueOn?: string | null;
  assigneeId?: string | null;
  caseId?: string | null;
  clientId?: string | null;
  matterId?: string | null;
};
export type TaskFilters = {
  scope?: "mine" | "team";
  status?: "active" | "done" | "all";
  type?: string;
  priority?: string;
  due?: "overdue" | "today" | "week" | "none";
  q?: string;
  caseId?: string;
  clientId?: string;
  matterId?: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Teammates @mentioned in a comment: by full name, first name or email name, longest match first. */
export function findMentions(body: string, members: { id: string; name: string | null; email: string }[]): string[] {
  const found = new Set<string>();
  const candidates = members
    .flatMap((m) => {
      const names = [m.name, m.name?.split(/\s+/)[0], m.email.split("@")[0]].filter((x): x is string => Boolean(x && x.length >= 2));
      return names.map((n) => ({ id: m.id, n }));
    })
    .sort((a, b) => b.n.length - a.n.length);
  let rest = body;
  for (const { id, n } of candidates) {
    const re = new RegExp(`(^|[^\\w@])@${escapeRe(n)}(?![\\w])`, "iu");
    if (re.test(rest)) {
      found.add(id);
      rest = rest.replace(new RegExp(`@${escapeRe(n)}`, "giu"), " ");
    }
  }
  return [...found];
}

export function createFirmTaskService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function audit(firmId: string, actorUserId: string, action: string, taskId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType: "FirmTask", targetId: taskId, metadata: metadata ?? undefined } });
  }
  const members = async (firmId: string) =>
    db.firmMembership.findMany({ where: { firmId, revokedAt: null }, select: { userId: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } });

  /** One inbox item about a task, at most once per key. */
  async function notify(firmId: string, task: { id: string; caseId: string | null }, key: string, toUserId: string) {
    await db.firmUpdate.createMany({ data: [{ firmId, caseId: task.caseId, kind: "TASK", taskId: task.id, alertKey: key, assignedToId: toUserId }], skipDuplicates: true });
  }

  async function clean(ctx: FirmContext, input: TaskInput) {
    const title = input.title.trim().replace(/\s+/g, " ");
    if (!title) return fail("Give the task a title.", "title");
    if (title.length > 140) return fail("Use 140 characters or fewer.", "title");
    const description = input.description?.trim() || null;
    if (description && description.length > 4000) return fail("Use 4,000 characters or fewer.", "description");
    const status = (input.status || "TODO") as FirmTaskStatus;
    if (!(status in TASK_STATUSES)) return fail("Choose a status.", "status");
    const type = (input.type || "GENERAL") as FirmTaskType;
    if (!(type in TASK_TYPES)) return fail("Choose a type.", "type");
    const priority = (input.priority || "NONE") as FirmTaskPriority;
    if (!(priority in TASK_PRIORITIES)) return fail("Choose a priority.", "priority");
    let dueOn: Date | null = null;
    if (input.dueOn) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || dayOf(asDate(input.dueOn)) !== input.dueOn) return fail("Enter the date, like 2026-12-01.", "dueOn");
      dueOn = asDate(input.dueOn);
    }
    const assigneeId = input.assigneeId || null;
    if (assigneeId && !(await db.firmMembership.findFirst({ where: { firmId: ctx.firm.id, userId: assigneeId, revokedAt: null }, select: { id: true } }))) {
      return fail("Choose someone on your team.", "assigneeId");
    }
    let caseId = input.caseId || null;
    let clientId = input.clientId || null;
    if (caseId) {
      const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true, clientId: true } });
      if (!c) return fail("Choose one of your firm's cases.", "caseId");
      clientId = clientId ?? c.clientId;
      caseId = c.id;
    }
    if (clientId && !(await db.client.findFirst({ where: { id: clientId, firmId: ctx.firm.id }, select: { id: true } }))) return fail("Choose one of your firm's clients.", "clientId");
    const matterId = input.matterId || null;
    if (matterId && !(await db.firmMatter.findFirst({ where: { id: matterId, firmId: ctx.firm.id }, select: { id: true } }))) return fail("Choose one of your firm's matters.", "matterId");
    return { ok: true as const, data: { title, description, status, type, priority, dueOn, assigneeId, caseId, clientId, matterId } };
  }

  /** Due-today/tomorrow and overdue items for one task (also run daily for every task). */
  async function syncDue(task: { id: string; firmId: string; caseId: string | null; dueOn: Date | null; status: FirmTaskStatus; assigneeId: string | null }, timeZone: string) {
    if (!task.dueOn || !task.assigneeId || task.status === "DONE") return 0;
    const today = easternDay(now(), timeZone);
    const days = Math.round((task.dueOn.getTime() - asDate(today).getTime()) / DAY);
    if (days > 1) return 0;
    const key = `task:${task.id}:${days < 0 ? "overdue" : "due"}:${dayOf(task.dueOn)}`;
    if (await db.firmUpdate.findUnique({ where: { alertKey: key }, select: { id: true } })) return 0;
    const owner = await inboxOwner(db, task.firmId, task.assigneeId, now());
    return (await db.firmUpdate.createMany({ data: [{ firmId: task.firmId, caseId: task.caseId, kind: "TASK", taskId: task.id, alertKey: key, assignedToId: owner }], skipDuplicates: true })).count;
  }

  async function raiseDue(firm: { id: string; timeZone: string }) {
    const today = easternDay(now(), firm.timeZone);
    const tasks = await db.firmTask.findMany({
      where: { firmId: firm.id, status: { in: ACTIVE }, assigneeId: { not: null }, dueOn: { lte: new Date(asDate(today).getTime() + DAY) } },
      select: { id: true, firmId: true, caseId: true, dueOn: true, status: true, assigneeId: true },
    });
    let n = 0;
    for (const t of tasks) n += await syncDue(t, firm.timeZone);
    return n;
  }

  const closeItems = (taskId: string, by: string | null) =>
    db.firmUpdate.updateMany({ where: { taskId, state: { not: "DONE" } }, data: { state: "DONE", resolvedAt: now(), resolvedById: by, snoozedUntil: null } });

  async function create(userId: string, input: TaskInput): Promise<{ ok: true; id: string } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const v = await clean(ctx, input);
    if (!v.ok) return v;
    const done = v.data.status === "DONE";
    const t = await db.firmTask.create({
      data: { ...v.data, firmId: ctx.firm.id, createdById: userId, ...(done ? { completedAt: now(), completedById: userId } : {}) },
      select: { id: true, firmId: true, caseId: true, dueOn: true, status: true, assigneeId: true },
    });
    await audit(ctx.firm.id, userId, "task.created", t.id, { title: v.data.title });
    if (t.assigneeId && t.assigneeId !== userId && !done) await notify(ctx.firm.id, t, `task:${t.id}:assigned:${t.assigneeId}`, t.assigneeId);
    await syncDue(t, ctx.firm.timeZone);
    return { ok: true, id: t.id };
  }

  async function find(ctx: FirmContext, id: string) {
    return db.firmTask.findFirst({ where: { id, firmId: ctx.firm.id } });
  }

  async function update(userId: string, id: string, input: TaskInput): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const before = await find(ctx, id);
    if (!before) return fail("Task not found.");
    const v = await clean(ctx, input);
    if (!v.ok) return v;
    const d = v.data;
    const changed = (
      [
        ["title", before.title !== d.title],
        ["description", (before.description ?? null) !== d.description],
        ["status", before.status !== d.status],
        ["type", before.type !== d.type],
        ["priority", before.priority !== d.priority],
        ["due date", (before.dueOn ? dayOf(before.dueOn) : null) !== (d.dueOn ? dayOf(d.dueOn) : null)],
        ["assignee", before.assigneeId !== d.assigneeId],
        ["case", before.caseId !== d.caseId],
        ["client", before.clientId !== d.clientId],
        ["matter", before.matterId !== d.matterId],
      ] as const
    )
      .filter(([, c]) => c)
      .map(([k]) => k);
    if (!changed.length) return { ok: true };
    const nowDone = d.status === "DONE";
    const wasDone = before.status === "DONE";
    const t = await db.firmTask.update({
      where: { id: before.id },
      data: { ...d, ...(nowDone && !wasDone ? { completedAt: now(), completedById: userId } : {}), ...(!nowDone && wasDone ? { completedAt: null, completedById: null } : {}) },
      select: { id: true, firmId: true, caseId: true, dueOn: true, status: true, assigneeId: true },
    });
    if (nowDone && !wasDone) await closeItems(t.id, userId);
    if ((changed as readonly string[]).includes("due date") || (!nowDone && wasDone)) {
      // A new date: earlier due reminders no longer apply.
      await db.firmUpdate.deleteMany({ where: { taskId: t.id, state: { not: "DONE" }, OR: [{ alertKey: { contains: ":due:" } }, { alertKey: { contains: ":overdue:" } }] } });
    }
    if (t.assigneeId && t.assigneeId !== before.assigneeId && t.assigneeId !== userId && !nowDone) await notify(ctx.firm.id, t, `task:${t.id}:assigned:${t.assigneeId}`, t.assigneeId);
    await syncDue(t, ctx.firm.timeZone);
    await audit(ctx.firm.id, userId, nowDone && !wasDone ? "task.completed" : !nowDone && wasDone ? "task.reopened" : "task.updated", t.id, { title: d.title, fields: changed });
    return { ok: true };
  }

  /** Mark done or open again (the list's checkbox). */
  async function setDone(userId: string, id: string, done: boolean): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const t = await find(ctx, id);
    if (!t) return fail("Task not found.");
    if ((t.status === "DONE") === done) return { ok: true };
    await db.firmTask.update({ where: { id: t.id }, data: done ? { status: "DONE", completedAt: now(), completedById: userId } : { status: "TODO", completedAt: null, completedById: null } });
    if (done) await closeItems(t.id, userId);
    else await syncDue({ ...t, status: "TODO" }, ctx.firm.timeZone);
    await audit(ctx.firm.id, userId, done ? "task.completed" : "task.reopened", t.id, { title: t.title });
    return { ok: true };
  }

  async function remove(userId: string, id: string): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const t = await find(ctx, id);
    if (!t) return fail("Task not found.");
    if (t.createdById !== userId && ctx.membership.role === "STAFF") return fail("Only the person who created this task, an Owner or an Admin can delete it.");
    await db.firmTask.delete({ where: { id: t.id } });
    await audit(ctx.firm.id, userId, "task.deleted", t.id, { title: t.title });
    return { ok: true };
  }

  async function addComment(userId: string, taskId: string, bodyInput: string): Promise<{ ok: true; mentioned: number } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const t = await find(ctx, taskId);
    if (!t) return fail("Task not found.");
    const body = bodyInput.trim();
    if (!body) return fail("Write a comment.", "body");
    if (body.length > 4000) return fail("Use 4,000 characters or fewer.", "body");
    const team = (await members(ctx.firm.id)).map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email }));
    const mentions = findMentions(body, team).filter((id) => id !== userId);
    const c = await db.firmTaskComment.create({ data: { taskId: t.id, firmId: ctx.firm.id, authorId: userId, body, mentions }, select: { id: true } });
    for (const m of mentions) await notify(ctx.firm.id, t, `task:${t.id}:mention:${c.id}:${m}`, m);
    await audit(ctx.firm.id, userId, "task.commented", t.id, { title: t.title, mentions: mentions.length });
    return { ok: true, mentioned: mentions.length };
  }

  const listSelect = {
    id: true,
    title: true,
    status: true,
    type: true,
    priority: true,
    dueOn: true,
    completedAt: true,
    assignee: { select: { id: true, name: true, email: true } },
    case: { select: { id: true, receiptMasked: true, nickname: true, formType: true } },
    client: { select: { id: true, displayName: true } },
    _count: { select: { comments: true } },
  } satisfies Prisma.FirmTaskSelect;

  async function list(userId: string, filters: TaskFilters = {}) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const today = asDate(easternDay(now(), ctx.firm.timeZone));
    const and: Prisma.FirmTaskWhereInput[] = [{ firmId: ctx.firm.id }];
    if (filters.scope !== "team") and.push({ assigneeId: userId });
    const status = filters.status ?? "active";
    if (status === "active") and.push({ status: { in: ACTIVE } });
    else if (status === "done") and.push({ status: "DONE" });
    if (filters.type && filters.type in TASK_TYPES) and.push({ type: filters.type as FirmTaskType });
    if (filters.priority && filters.priority in TASK_PRIORITIES) and.push({ priority: filters.priority as FirmTaskPriority });
    if (filters.due === "overdue") and.push({ dueOn: { lt: today } });
    else if (filters.due === "today") and.push({ dueOn: today });
    else if (filters.due === "week") and.push({ dueOn: { gte: today, lte: new Date(today.getTime() + 6 * DAY) } });
    else if (filters.due === "none") and.push({ dueOn: null });
    if (filters.caseId) and.push({ caseId: filters.caseId });
    if (filters.clientId) and.push({ clientId: filters.clientId });
    if (filters.matterId) and.push({ OR: [{ matterId: filters.matterId }, { case: { matterId: filters.matterId } }] });
    const q = filters.q?.trim().slice(0, 80);
    if (q) {
      const contains = { contains: q, mode: "insensitive" as const };
      and.push({ OR: [{ title: contains }, { description: contains }, { client: { displayName: contains } }, { case: { nickname: contains } }] });
    }
    const rows = await db.firmTask.findMany({ where: { AND: and }, select: listSelect, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300 });
    // Within a day, most urgent first.
    rows.sort((a, b) => (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
    const [mine, team, overdue] = await Promise.all([
      db.firmTask.count({ where: { firmId: ctx.firm.id, assigneeId: userId, status: { in: ACTIVE } } }),
      db.firmTask.count({ where: { firmId: ctx.firm.id, status: { in: ACTIVE } } }),
      db.firmTask.count({ where: { firmId: ctx.firm.id, status: { in: ACTIVE }, dueOn: { lt: today }, ...(filters.scope !== "team" ? { assigneeId: userId } : {}) } }),
    ]);
    return { ctx, today: dayOf(today), tasks: rows, counts: { mine, team, overdue } };
  }

  /** A month of task due dates and case deadlines, for the calendar. */
  async function calendar(userId: string, month: string, scope: "mine" | "team" = "mine") {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const m = /^\d{4}-\d{2}$/.test(month) ? month : easternDay(now(), ctx.firm.timeZone).slice(0, 7);
    const start = asDate(`${m}-01`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const [tasks, deadlines] = await Promise.all([
      db.firmTask.findMany({
        where: { firmId: ctx.firm.id, dueOn: { gte: start, lt: end }, ...(scope === "mine" ? { assigneeId: userId } : {}) },
        select: { id: true, title: true, status: true, priority: true, dueOn: true },
        orderBy: { dueOn: "asc" },
      }),
      db.caseDeadline.findMany({
        where: { firmId: ctx.firm.id, doneAt: null, dueOn: { gte: start, lt: end }, ...(scope === "mine" ? { case: { assigneeId: userId } } : {}) },
        select: { id: true, kind: true, dueOn: true, case: { select: { id: true, receiptMasked: true, nickname: true } } },
        orderBy: { dueOn: "asc" },
      }),
    ]);
    return { ctx, month: m, today: easternDay(now(), ctx.firm.timeZone), tasks, deadlines };
  }

  async function get(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const task = await db.firmTask.findFirst({
      where: { id, firmId: ctx.firm.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        completedBy: { select: { name: true, email: true } },
        case: { select: { id: true, receiptMasked: true, nickname: true, formType: true } },
        client: { select: { id: true, displayName: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, email: true } } } },
      },
    });
    if (!task) return null;
    const team = await members(ctx.firm.id);
    return { ctx, task, members: team.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email })) };
  }

  /** The Tasks tab's badge: my open tasks due today or earlier. */
  async function dueCount(firm: { id: string; timeZone: string }, userId: string) {
    const today = asDate(easternDay(now(), firm.timeZone));
    return db.firmTask.count({ where: { firmId: firm.id, assigneeId: userId, status: { in: ACTIVE }, dueOn: { lte: today } } });
  }

  return { create, update, setDone, remove, addComment, list, calendar, get, dueCount, raiseDue, syncDue };
}

export type FirmTaskService = ReturnType<typeof createFirmTaskService>;
