import type { UscisErrorKind } from "@/lib/uscis/errors";

// Limits that keep us polite to USCIS and well inside its quotas
// (sandbox: 1,000 requests/day, 5 TPS; production: 400,000/day, 10 TPS).

const intEnv = (name: string, fallback: number, env: Record<string, string | undefined> = process.env) => {
  const n = Number(env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const MANUAL_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
export const MANUAL_REFRESHES_PER_USER_PER_DAY = 30;
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

/** What the user sees when a check fails. Never USCIS internals. */
export function checkFailureMessage(kind: UscisErrorKind | string): string {
  switch (kind) {
    case "not_found":
    case "bad_request":
    case "invalid_receipt":
      return "USCIS couldn't find a case for this receipt number. Check the number on your USCIS notice.";
    case "rate_limited":
      return "USCIS is busy right now. We'll try again automatically later.";
    case "sandbox_only":
      return "During sandbox testing, only USCIS sample receipt numbers can be checked.";
    default:
      return "USCIS couldn't be reached right now. We'll try again automatically later.";
  }
}

export function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? "about a minute" : `${minutes} minutes`;
}
