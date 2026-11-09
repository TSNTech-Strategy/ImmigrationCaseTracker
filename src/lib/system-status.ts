import type { PrismaClient } from "@prisma/client";

/**
 * Live system status for the public status page and the health endpoint. Everything is measured
 * now, from real signals: no invented uptime history. Shows rates, never counts of customers' cases.
 */

export type Level = "operational" | "degraded" | "down" | "not_configured";
export type Component = { key: string; name: string; level: Level; detail: string };
export type SystemStatus = { checkedAt: Date; overall: Level; components: Component[] };

const HOUR = 3_600_000;
/** Scheduled checks run about every 12 hours per case; a gap longer than this means the scheduler is behind. */
const SCHEDULE_GRACE_HOURS = 14;
const ORDER: Level[] = ["operational", "not_configured", "degraded", "down"];
/**
 * Check outcomes where USCIS did answer. "Case not found" or "receipt not accepted" are about one
 * receipt (or, in the USCIS sandbox, any real receipt), not USCIS being unavailable.
 */
export const ANSWERED_OUTCOMES = ["ok", "not_found", "bad_request", "invalid_receipt"];

export function worst(levels: Level[]): Level {
  // "Not configured" parts (e.g. email on a preview) don't make the whole service look broken.
  const relevant = levels.filter((l) => l !== "not_configured");
  if (relevant.length === 0) return "operational";
  return relevant.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), "operational" as Level);
}

const ago = (d: Date, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
};

export async function getSystemStatus({
  db,
  now = () => new Date(),
  config,
}: {
  db: PrismaClient;
  now?: () => Date;
  config: { storage: boolean; email: boolean; jobs: boolean };
}): Promise<SystemStatus> {
  const t = now();
  const components: Component[] = [{ key: "website", name: "Website and app", level: "operational", detail: "Pages and the mobile app's API are responding." }];

  // Database: a trivial query, timed.
  let dbOk = false;
  try {
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - started;
    dbOk = true;
    components.push({ key: "database", name: "Database", level: ms > 2000 ? "degraded" : "operational", detail: ms > 2000 ? "Responding slowly." : "Responding normally." });
  } catch {
    components.push({ key: "database", name: "Database", level: "down", detail: "Not responding. We're on it." });
  }

  // USCIS checks: success rate over the last 24 hours, and how recently the scheduler ran.
  if (dbOk) {
    const since = new Date(t.getTime() - 24 * HOUR);
    const [total, ok, lastScheduled] = await Promise.all([
      db.caseCheckRun.count({ where: { attemptedAt: { gte: since } } }),
      db.caseCheckRun.count({ where: { attemptedAt: { gte: since }, outcome: { in: ANSWERED_OUTCOMES } } }),
      db.caseCheckRun.findFirst({ where: { trigger: "SCHEDULED" }, orderBy: { attemptedAt: "desc" }, select: { attemptedAt: true } }),
    ]);
    if (total === 0) {
      components.push({ key: "uscis", name: "USCIS status checks", level: "operational", detail: "No checks were due in the last 24 hours." });
    } else {
      const rate = ok / total;
      const pct = Math.round(rate * 1000) / 10;
      const level: Level = ok === 0 ? "down" : rate < 0.9 ? "degraded" : "operational";
      components.push({
        key: "uscis",
        name: "USCIS status checks",
        level,
        detail: level === "operational" ? `${pct}% of checks in the last 24 hours got an answer from USCIS.` : level === "degraded" ? `Only ${pct}% of checks in the last 24 hours got an answer from USCIS. Checks are retried automatically.` : "USCIS isn't answering our checks right now. They're retried automatically.",
      });
    }
    if (!config.jobs) {
      components.push({ key: "jobs", name: "Scheduled checks and reminders", level: "not_configured", detail: "Not set up on this site." });
    } else if (!lastScheduled) {
      components.push({ key: "jobs", name: "Scheduled checks and reminders", level: "operational", detail: "Waiting for the first scheduled run." });
    } else {
      const late = t.getTime() - lastScheduled.attemptedAt.getTime() > SCHEDULE_GRACE_HOURS * HOUR;
      components.push({ key: "jobs", name: "Scheduled checks and reminders", level: late ? "degraded" : "operational", detail: late ? `The last scheduled run was ${ago(lastScheduled.attemptedAt, t)}; runs are behind.` : `Last scheduled run ${ago(lastScheduled.attemptedAt, t)}.` });
    }
  }

  components.push({ key: "email", name: "Email delivery", level: config.email ? "operational" : "not_configured", detail: config.email ? "Connected to our email provider." : "Not set up on this site." });
  components.push({ key: "storage", name: "Document storage", level: config.storage ? "operational" : "not_configured", detail: config.storage ? "Encrypted storage is connected." : "Not set up on this site." });

  return { checkedAt: t, overall: worst(components.map((c) => c.level)), components };
}

/** Incidents we post by hand (newest first). Keep entries short and factual; never include customer data. */
export type Incident = { date: string; title: string; summary: string; resolved: boolean };
export const INCIDENTS: Incident[] = [];
