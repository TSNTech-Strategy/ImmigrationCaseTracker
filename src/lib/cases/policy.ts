import type { UscisErrorKind } from "@/lib/uscis/errors";

// Limits that keep us polite to USCIS and well inside its quotas
// (sandbox: 1,000 requests/day, 5 TPS; production: 400,000/day, 10 TPS).

const intEnv = (name: string, fallback: number, env: Record<string, string | undefined> = process.env) => {
  const n = Number(env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const MANUAL_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
export const MANUAL_REFRESHES_PER_USER_PER_DAY = 30;
/** Shared by everyone in a firm. */
export const MANUAL_REFRESHES_PER_FIRM_PER_DAY = 100;
/** Global cap on USCIS case-status calls per UTC day, across all users. */
export const uscisDailyBudget = (env?: Record<string, string | undefined>) => intEnv("USCIS_DAILY_BUDGET", 800, env);

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Milliseconds until a manual refresh is allowed again (0 = allowed now). */
export function cooldownRemainingMs(lastCheckedAt: Date | null, now: Date): number {
  if (!lastCheckedAt) return 0;
  return Math.max(0, lastCheckedAt.getTime() + MANUAL_REFRESH_COOLDOWN_MS - now.getTime());
}

/** Backoff after consecutive failures: 1h, 2h, 4h … capped at 24h. */
export function nextCheckAfterFailure(now: Date, consecutiveFailures: number): Date {
  const hours = Math.min(24, 2 ** Math.max(0, consecutiveFailures - 1));
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * What the user sees when a check fails, for each response the Case Status API
 * documents (401, 404, 422, 429, 503) plus network trouble. Our explanation;
 * USCIS's own error message is shown next to it (see uscisErrorText).
 */
export function checkFailureMessage(kind: UscisErrorKind | string, httpStatus?: number | null): string {
  switch (kind) {
    case "not_found":
      // USCIS also answers 404 for people protected under 8 U.S.C. 1367; it
      // sends them to its Contact Center, so we do too.
      return "USCIS doesn't recognize this receipt number. Check it against your USCIS notice. If it's correct, call the USCIS Contact Center at 1-800-375-5283.";
    case "bad_request":
    case "invalid_receipt":
      return "This receipt number isn't in USCIS's format: 3 letters followed by 10 digits, as printed on your notice.";
    case "auth":
      return "CasePingo couldn't sign in to USCIS. This is on our side, and we'll try again automatically.";
    case "rate_limited":
      return "USCIS is busy right now. We'll try again automatically later.";
    case "sandbox_only":
      return "During sandbox testing, only USCIS sample receipt numbers can be checked.";
    case "server":
      return httpStatus === 503
        ? "USCIS's case status service is unavailable right now. We'll try again automatically later."
        : "USCIS had a problem answering. We'll try again automatically later.";
    default:
      return "USCIS couldn't be reached right now. We'll try again automatically later.";
  }
}

/** USCIS's own words for a failed check, e.g. `USCIS said (HTTP 404): "…"`. */
export function uscisErrorText(httpStatus: number | null | undefined, message: string | null | undefined): string | null {
  if (!message) return null;
  return `USCIS said${httpStatus ? ` (HTTP ${httpStatus})` : ""}: "${message}"`;
}

export function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? "about a minute" : `${minutes} minutes`;
}
