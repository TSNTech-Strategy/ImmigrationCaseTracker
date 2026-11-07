import type { DeadlineKind, Prisma, PrismaClient } from "@prisma/client";
import { caseViewSelect } from "@/lib/cases/service";
import { caseJourney } from "@/lib/journeys";
import { firmChecksAllowedWhere } from "@/lib/billing/entitlements";
import { findFirmContext } from "./service";
import { inboxOwner } from "./team";

/**
 * Two kinds of alerts in a firm's Updates inbox, beside USCIS status changes:
 *
 * - **Stuck cases:** no change from USCIS for the firm's chosen number of days (90 by default),
 *   for cases that aren't finished. One alert per case and status: a new status, then another
 *   long wait, raises a new one. A status change closes the open stuck alert by itself.
 * - **Deadlines:** dates the firm enters on a case (an RFE response from the notice, an interview,
 *   a filing). A reminder the firm's chosen days before (7 by default), and another once it's overdue.
 *   Marking the deadline done closes its reminders.
 *
 * CasePingo never works out a legal deadline itself: the firm enters the date from the notice.
 * "Today" is the date in the firm's time zone.
 */

export const DEADLINE_KINDS: Record<DeadlineKind, { label: string; prompt: string | null }> = {
  RFE_RESPONSE: { label: "RFE response due", prompt: "USCIS sent a Request for Evidence. Add the response due date from the notice." },
  NOID_RESPONSE: { label: "NOID response due", prompt: "USCIS sent a Notice of Intent to Deny. Add the response due date from the notice." },
  INTERVIEW: { label: "Interview", prompt: "USCIS scheduled an interview. Add the date from the interview notice." },
  BIOMETRICS: { label: "Biometrics appointment", prompt: "USCIS scheduled biometrics. Add the appointment date from the notice." },
  FILING: { label: "Filing deadline", prompt: null },
  OTHER: { label: "Other", prompt: null },
};

export const STUCK_DAY_CHOICES = [0, 60, 90, 120, 180] as const;
export const LEAD_DAY_CHOICES = [3, 7, 14, 30] as const;

/** The deadline a new status suggests the firm should add (the date itself comes from the notice). */
export function suggestedDeadline(statusTitleEn: string | null | undefined): DeadlineKind | null {
  const t = statusTitleEn ?? "";
  if (/intent to deny/i.test(t)) return "NOID_RESPONSE";
  if (/request for (additional )?evidence|evidence request/i.test(t) && !/received|response/i.test(t)) return "RFE_RESPONSE";
  if (/interview was scheduled/i.test(t)) return "INTERVIEW";
  if (/(fingerprint|biometric)s? (appointment )?(review )?was scheduled/i.test(t)) return "BIOMETRICS";
  return null;
}

const DAY = 86_400_000;
/** "YYYY-MM-DD" in a time zone (the firm's; US Eastern by default). */
export function easternDay(d: Date, timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const dayOfDate = (d: Date) => d.toISOString().slice(0, 10);
/** Whole days from today to a due date (negative when overdue). */
export const daysUntil = (dueOn: Date, today: string) => Math.round((dueOn.getTime() - asDate(today).getTime()) / DAY);

export function formatDue(dueOn: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(dueOn);
}
export function dueText(dueOn: Date, today: string) {
  const n = daysUntil(dueOn, today);
  if (n < 0) return `overdue by ${-n} day${n === -1 ? "" : "s"}`;
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  return `in ${n} days`;
}

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export type DeadlineInput = { kind: string; dueOn: string; note?: string | null };

export function createFirmAlertService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function audit(firmId: string, actorUserId: string, action: string, targetId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType: "TrackedCase", targetId, metadata: metadata ?? undefined } });
  }

  // ---- Raising alerts ------------------------------------------------------------------------

  /** Stuck alerts for one firm's cases. Returns how many were raised. */
  async function raiseStuck(firm: { id: string; stuckAfterDays: number }): Promise<number> {
    if (firm.stuckAfterDays <= 0) return 0;
    const t = now();
    // Days since the last change, from USCIS's own dates (as on the case page), else when we saw it change.
    const cases = await db.trackedCase.findMany({
      where: { firmId: firm.id, trackingStatus: "ACTIVE", statusFingerprint: { not: null } },
      select: { ...caseViewSelect, statusFingerprint: true, assigneeId: true, events: { select: { statusTitleEn: true, uscisReportedRaw: true, firstObservedAt: true }, orderBy: { firstObservedAt: "asc" } } },
    });
    const data: Prisma.FirmUpdateCreateManyInput[] = [];
    for (const c of cases) {
      const j = caseJourney(c, t);
      const since = j.days.sinceUpdate;
      if (j.lineMap.finished || since === null || since < firm.stuckAfterDays) continue;
      data.push({ firmId: firm.id, caseId: c.id, kind: "STUCK", alertKey: `stuck:${c.id}:${c.statusFingerprint}`, stuckDays: since, assignedToId: c.assigneeId });
    }
    if (!data.length) return 0;
    return (await db.firmUpdate.createMany({ data: await routeAway(firm.id, data), skipDuplicates: true })).count;
  }

  /** New alerts for someone who's away go to their backup (Settings › My notifications). */
  async function routeAway(firmId: string, rows: Prisma.FirmUpdateCreateManyInput[]) {
    const fresh = await db.firmUpdate.findMany({ where: { alertKey: { in: rows.map((r) => r.alertKey!).filter(Boolean) } }, select: { alertKey: true } });
    const exists = new Set(fresh.map((f) => f.alertKey));
    const owners = new Map<string, string | null>();
    for (const id of new Set(rows.map((r) => r.assignedToId).filter((x): x is string => Boolean(x)))) owners.set(id, await inboxOwner(db, firmId, id, now()));
    return rows.filter((r) => !exists.has(r.alertKey ?? null)).map((r) => (r.assignedToId ? { ...r, assignedToId: owners.get(r.assignedToId) ?? r.assignedToId } : r));
  }

  type DeadlineRow = { id: string; firmId: string; caseId: string; dueOn: Date; case: { assigneeId: string | null } };
  const deadlineAlert = (d: DeadlineRow, today: string, leadDays: number): Prisma.FirmUpdateCreateManyInput | null => {
    const n = daysUntil(d.dueOn, today);
    if (n > leadDays) return null;
    return { firmId: d.firmId, caseId: d.caseId, kind: "DEADLINE", deadlineId: d.id, alertKey: `deadline:${d.id}:${n < 0 ? "overdue" : "soon"}`, assignedToId: d.case.assigneeId };
  };

  /** Reminders for one firm's open deadlines that are close or overdue. */
  async function raiseDeadlines(firm: { id: string; deadlineLeadDays: number; timeZone?: string }): Promise<number> {
    const today = easternDay(now(), firm.timeZone);
    const due = await db.caseDeadline.findMany({
      where: { firmId: firm.id, doneAt: null, dueOn: { lte: asDate(dayOfDate(new Date(asDate(today).getTime() + firm.deadlineLeadDays * DAY))) } },
      select: { id: true, firmId: true, caseId: true, dueOn: true, case: { select: { assigneeId: true } } },
    });
    const data = due.map((d) => deadlineAlert(d, today, firm.deadlineLeadDays)).filter((x): x is Prisma.FirmUpdateCreateManyInput => x !== null);
    if (!data.length) return 0;
    return (await db.firmUpdate.createMany({ data: await routeAway(firm.id, data), skipDuplicates: true })).count;
  }

  /** The daily run over every firm whose cases are being checked (Inngest cron). */
  async function runDaily() {
    const firms = await db.firm.findMany({ where: firmChecksAllowedWhere(now()), select: { id: true, stuckAfterDays: true, deadlineLeadDays: true, timeZone: true } });
    let stuck = 0;
    let deadlines = 0;
    for (const f of firms) {
      stuck += await raiseStuck(f);
      deadlines += await raiseDeadlines(f);
    }
    return { firms: firms.length, stuck, deadlines };
  }

  /** A deadline was added or its date changed: remind now if it's already close. */
  async function syncDeadline(id: string) {
    const d = await db.caseDeadline.findUnique({
      where: { id },
      select: { id: true, firmId: true, caseId: true, dueOn: true, doneAt: true, case: { select: { assigneeId: true } }, firm: { select: { deadlineLeadDays: true, timeZone: true } } },
    });
    if (!d || d.doneAt) return;
    const a = deadlineAlert(d, easternDay(now(), d.firm.timeZone), d.firm.deadlineLeadDays);
    if (a) await db.firmUpdate.createMany({ data: await routeAway(d.firmId, [a]), skipDuplicates: true });
  }

  // ---- Deadlines (any member) ------------------------------------------------------------------

  function cleanDeadline(input: DeadlineInput, timeZone?: string): { ok: true; data: { kind: DeadlineKind; dueOn: Date; note: string | null } } | Fail {
    if (!(input.kind in DEADLINE_KINDS)) return fail("Choose what the deadline is for.", "kind");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || Number.isNaN(asDate(input.dueOn).getTime()) || dayOfDate(asDate(input.dueOn)) !== input.dueOn) {
      return fail("Enter the date, like 2026-12-01.", "dueOn");
    }
    const today = easternDay(now(), timeZone);
    const n = daysUntil(asDate(input.dueOn), today);
    if (n < -365 || n > 3 * 365) return fail("Enter a date within a year back and three years ahead.", "dueOn");
    const note = input.note?.trim().replace(/\s+/g, " ") || null;
    if (note && note.length > 120) return fail("Use 120 characters or fewer.", "note");
    if (input.kind === "OTHER" && !note) return fail("Say what the deadline is for.", "note");
    return { ok: true, data: { kind: input.kind as DeadlineKind, dueOn: asDate(input.dueOn), note } };
  }

  async function addDeadline(userId: string, caseId: string, input: DeadlineInput): Promise<{ ok: true; id: string } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true } });
    if (!c) return fail("Case not found.");
    const v = cleanDeadline(input, ctx.firm.timeZone);
    if (!v.ok) return v;
    const open = await db.caseDeadline.count({ where: { caseId: c.id, doneAt: null } });
    if (open >= 20) return fail("A case can have up to 20 open deadlines.");
    const d = await db.caseDeadline.create({ data: { ...v.data, firmId: ctx.firm.id, caseId: c.id, createdById: userId }, select: { id: true } });
    await audit(ctx.firm.id, userId, "deadline.added", c.id, { kind: v.data.kind, dueOn: dayOfDate(v.data.dueOn) });
    await syncDeadline(d.id);
    return { ok: true, id: d.id };
  }

  async function findDeadline(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const d = await db.caseDeadline.findFirst({ where: { id, firmId: ctx.firm.id }, select: { id: true, caseId: true, kind: true, dueOn: true, doneAt: true } });
    return d ? { ctx, d } : null;
  }

  async function setDeadlineDone(userId: string, id: string, done: boolean): Promise<{ ok: true } | Fail> {
    const f = await findDeadline(userId, id);
    if (!f) return fail("Deadline not found.");
    const { ctx, d } = f;
    if (Boolean(d.doneAt) === done) return { ok: true };
    const t = now();
    await db.$transaction([
      db.caseDeadline.update({ where: { id: d.id }, data: done ? { doneAt: t, doneById: userId } : { doneAt: null, doneById: null } }),
      // Done: its reminders are done too. Reopened: its reminders can come back.
      done
        ? db.firmUpdate.updateMany({ where: { deadlineId: d.id, state: { not: "DONE" } }, data: { state: "DONE", resolvedAt: t, resolvedById: userId, snoozedUntil: null } })
        : db.firmUpdate.deleteMany({ where: { deadlineId: d.id } }),
    ]);
    await audit(ctx.firm.id, userId, done ? "deadline.done" : "deadline.reopened", d.caseId, { kind: d.kind, dueOn: dayOfDate(d.dueOn) });
    if (!done) await syncDeadline(d.id);
    return { ok: true };
  }

  async function removeDeadline(userId: string, id: string): Promise<{ ok: true } | Fail> {
    const f = await findDeadline(userId, id);
    if (!f) return fail("Deadline not found.");
    await db.caseDeadline.delete({ where: { id: f.d.id } }); // its reminders go with it
    await audit(f.ctx.firm.id, userId, "deadline.removed", f.d.caseId, { kind: f.d.kind, dueOn: dayOfDate(f.d.dueOn) });
    return { ok: true };
  }

  const deadlineSelect = {
    id: true,
    kind: true,
    dueOn: true,
    note: true,
    doneAt: true,
    doneBy: { select: { name: true, email: true } },
    createdBy: { select: { name: true, email: true } },
  } as const;

  /** A case's deadlines: open ones by date, then done ones. */
  async function caseDeadlines(firmId: string, caseId: string) {
    return db.caseDeadline.findMany({ where: { firmId, caseId }, select: deadlineSelect, orderBy: [{ doneAt: { sort: "desc", nulls: "first" } }, { dueOn: "asc" }] });
  }

  /** The firm's deadline list: overdue and upcoming (open), and the last 30 days of done ones. */
  async function firmDeadlines(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const t = now();
    const select = { ...deadlineSelect, case: { select: { id: true, receiptMasked: true, nickname: true, formType: true, statusTitleEn: true, client: { select: { id: true, displayName: true } } } } } as const;
    const [open, done] = await Promise.all([
      db.caseDeadline.findMany({ where: { firmId: ctx.firm.id, doneAt: null }, select, orderBy: { dueOn: "asc" }, take: 300 }),
      db.caseDeadline.findMany({ where: { firmId: ctx.firm.id, doneAt: { gte: new Date(t.getTime() - 30 * DAY) } }, select, orderBy: { doneAt: "desc" }, take: 100 }),
    ]);
    return { ctx, today: easternDay(t, ctx.firm.timeZone), open, done };
  }

  async function openDeadlineCount(firm: { id: string; timeZone: string }) {
    const today = easternDay(now(), firm.timeZone);
    return db.caseDeadline.count({ where: { firmId: firm.id, doneAt: null, dueOn: { lte: asDate(dayOfDate(new Date(asDate(today).getTime() + 7 * DAY))) } } });
  }

  // ---- Settings (Owner/Admin) ----------------------------------------------------------------

  async function saveAlertSettings(userId: string, input: { stuckAfterDays: number; deadlineLeadDays: number }): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx || ctx.membership.role === "STAFF") return fail("Only an Owner or Admin can change alerts.");
    if (!(STUCK_DAY_CHOICES as readonly number[]).includes(input.stuckAfterDays)) return fail("Choose when a case counts as stuck.", "stuckAfterDays");
    if (!(LEAD_DAY_CHOICES as readonly number[]).includes(input.deadlineLeadDays)) return fail("Choose when to be reminded.", "deadlineLeadDays");
    const before = { stuckAfterDays: ctx.firm.stuckAfterDays, deadlineLeadDays: ctx.firm.deadlineLeadDays };
    if (before.stuckAfterDays === input.stuckAfterDays && before.deadlineLeadDays === input.deadlineLeadDays) return { ok: true };
    await db.firm.update({ where: { id: ctx.firm.id }, data: input });
    await db.auditLog.create({ data: { firmId: ctx.firm.id, actorUserId: userId, action: "firm.alerts", targetType: "Firm", targetId: ctx.firm.id, metadata: { from: before, to: input } } });
    // Apply the new settings right away rather than at the next daily run.
    await raiseStuck({ id: ctx.firm.id, stuckAfterDays: input.stuckAfterDays });
    await raiseDeadlines({ id: ctx.firm.id, deadlineLeadDays: input.deadlineLeadDays, timeZone: ctx.firm.timeZone });
    return { ok: true };
  }

  const today = (timeZone?: string) => easternDay(now(), timeZone);

  return { today, raiseStuck, raiseDeadlines, runDaily, syncDeadline, addDeadline, setDeadlineDone, removeDeadline, caseDeadlines, firmDeadlines, openDeadlineCount, saveAlertSettings };
}

export type FirmAlertService = ReturnType<typeof createFirmAlertService>;
