import { findStatusGuide } from "@/lib/status-guide";

/**
 * How often a case is checked automatically. USCIS gives each app a fixed daily quota, so we
 * spend it where news is likely: cases that just changed or are at a step that moves fast are
 * checked about twice a day; cases quiet for weeks once a day; long-quiet cases every two days;
 * finished cases (card delivered, denied, withdrawn) once a week. Every case on automatic checks
 * is checked at least every 2 days unless it's finished.
 *
 * A status change always puts the case back in the "active" tier.
 */

export type CadenceTier = "active" | "steady" | "quiet" | "settled";

export const TIER_HOURS: Record<CadenceTier, number> = { active: 12, steady: 24, quiet: 48, settled: 168 };

/** A change in the last two weeks means more news may follow soon. */
const RECENT_CHANGE_DAYS = 14;
/** Nothing for three months: the case is in a long wait. */
const QUIET_AFTER_DAYS = 90;

/** Steps where the next update usually comes within days or weeks. */
const ACTIVE_SLUGS = new Set([
  "biometrics-appointment-was-scheduled",
  "request-for-evidence-was-sent",
  "request-for-initial-evidence-was-sent",
  "response-to-request-for-evidence-was-received",
  "interview-was-scheduled",
  "interview-was-completed",
  "interview-was-cancelled",
  "ready-to-be-scheduled-for-an-interview",
  "case-was-reopened",
  "case-was-approved",
  "approval-was-reaffirmed",
  "new-card-is-being-produced",
  "card-was-mailed",
  "card-was-picked-up-by-usps",
  "document-was-mailed",
  "oath-ceremony-was-scheduled",
  "case-was-sent-to-the-department-of-state",
  "mail-was-returned-to-uscis",
]);

/** Steps where the case is over; a weekly look still catches a reopening or a returned card. */
const SETTLED_SLUGS = new Set([
  "card-was-delivered",
  "case-was-denied",
  "case-was-rejected",
  "withdrawal-acknowledgement-notice-was-sent",
  "case-closed-benefit-received-by-other-means",
]);

const DAY = 86_400_000;

export type CadenceInput = {
  /** Current status title in English, or null before the first check. */
  statusTitleEn: string | null;
  /** When we last saw the status change (null if never). */
  lastChangeObservedAt: Date | null;
  /** When the case was added. */
  createdAt: Date;
};

export function cadenceTier(c: CadenceInput, now: Date): CadenceTier {
  if (!c.statusTitleEn) return "active";
  const slug = findStatusGuide(c.statusTitleEn)?.slug;
  const since = c.lastChangeObservedAt ?? c.createdAt;
  const quietDays = (now.getTime() - since.getTime()) / DAY;
  if (quietDays < RECENT_CHANGE_DAYS) return "active";
  if (slug && SETTLED_SLUGS.has(slug)) return "settled";
  if (slug && ACTIVE_SLUGS.has(slug)) return "active";
  return quietDays >= QUIET_AFTER_DAYS ? "quiet" : "steady";
}

/**
 * Time until the next automatic check. `minHours` is the plan's floor (no plan is checked more
 * often than it pays for). A ±10% spread keeps cases added together from all coming due at once.
 */
export function nextCheckDelayMs(c: CadenceInput, now: Date, { minHours = 12, random = Math.random }: { minHours?: number; random?: () => number } = {}): number {
  const hours = Math.max(minHours, TIER_HOURS[cadenceTier(c, now)]);
  const spread = 0.9 + random() * 0.2;
  return Math.round(hours * spread * 3_600_000);
}

/** Expected automatic checks per day for one case at its current tier. */
export function checksPerDay(c: CadenceInput, now: Date, minHours = 12): number {
  return 24 / Math.max(minHours, TIER_HOURS[cadenceTier(c, now)]);
}
