import { checkCase } from "./functions/check-case";
import { notifyStatusChangeFn } from "./functions/notify-status-change";
import { scheduleChecks } from "./functions/schedule-checks";

// Every background function, and which of them a deployment may run.
// Same rule as Scanvio: scheduled (cron) functions run only on production —
// or off Vercel (local dev / tests). A preview deployment shares the
// production database and must never start its own polling.

export const ALL_FUNCTIONS = [scheduleChecks, checkCase, notifyStatusChangeFn];

type Fn = (typeof ALL_FUNCTIONS)[number];

export function isScheduled(fn: Pick<Fn, "opts">): boolean {
  const triggers: ReadonlyArray<object> = fn.opts.triggers ?? [];
  return triggers.some((t) => "cron" in t);
}

export function functionsFor(env: Record<string, string | undefined>): Fn[] {
  const onVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
  if (!onVercel || env.VERCEL_ENV === "production") return ALL_FUNCTIONS;
  return ALL_FUNCTIONS.filter((fn) => !isScheduled(fn));
}
