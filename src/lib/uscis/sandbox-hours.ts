import { isMockUscis, type Env } from "./config";

/**
 * USCIS's Case Status API test system (sandbox) only answers Monday to Friday, 7:00 AM to 8:00 PM
 * Eastern. Outside those hours it returns 503 "The Case Status API Sandbox is unavailable at this
 * time". Production has no such hours. Federal holidays aren't modelled: a check that day just fails
 * and is retried.
 */
export const SANDBOX_HOURS_TEXT = "Monday to Friday, 7 AM to 8 PM Eastern";

const OPEN_HOUR = 7;
const CLOSE_HOUR = 20;
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" });

export function sandboxOpen(now: Date): boolean {
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const hour = Number(parts.hour);
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** Real calls going to the USCIS test system (not mock mode, not production). */
export function onRealSandbox(env: Env = process.env): boolean {
  return !isMockUscis(env) && (env.USCIS_ENV?.trim() || "sandbox") !== "production";
}

/** Whether scheduled checks should wait because the USCIS test system is closed right now. */
export function sandboxClosedNow(now: Date, env: Env = process.env): boolean {
  return onRealSandbox(env) && !sandboxOpen(now);
}
