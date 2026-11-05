/**
 * USCIS sandbox smoke test — run once a day for the five-consecutive-day
 * traffic requirement before requesting production access.
 *
 *   npm run uscis:smoke                     # standard daily run
 *   npm run uscis:smoke -- --with-auth-error  # also prove 401 handling (bad secret)
 *   npm run uscis:smoke -- --show-errors      # print USCIS's raw error bodies (console only)
 *
 * Reads USCIS_CLIENT_ID / USCIS_CLIENT_SECRET from .env (never committed).
 * Calls go through the same adapter the app uses (src/lib/uscis), and only
 * use USCIS's published staging receipts. Each result is appended, sanitized,
 * to docs/uscis-evidence/YYYY-MM.jsonl — no tokens, secrets or raw payloads.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getUscisConfig, type UscisConfig } from "@/lib/uscis/config";
import { fetchCaseStatus } from "@/lib/uscis/client";
import { clearUscisTokenCache } from "@/lib/uscis/token";
import { UscisError } from "@/lib/uscis/errors";
import { SANDBOX_RECEIPTS } from "@/lib/receipt";

type Entry = {
  ts: string;
  dateCentral: string;
  source: "backend-smoke";
  env: string;
  test: string;
  receipt: string;
  httpStatus: number | null;
  outcome: string;
  attempts: number | null;
  durationMs: number;
  tokenRequests: number;
  formType?: string | null;
  statusTitleEn?: string | null;
  hasHistory?: boolean;
  errorCodes?: string[];
  /** USCIS's own error message (generic wording, e.g. the receipt-format rule). */
  errorMessage?: string;
};

const withAuthError = process.argv.includes("--with-auth-error");
const showErrors = process.argv.includes("--show-errors");
/** Raw error bodies by test name — printed with --show-errors, never written to the log. */
const errorBodies = new Map<string, unknown>();

let config: UscisConfig;
try {
  config = getUscisConfig();
} catch (err) {
  console.error(`✖ ${(err as Error).message}\n  Put USCIS_CLIENT_ID and USCIS_CLIENT_SECRET in .env (see .env.example).`);
  process.exit(1);
}
if (config.env !== "sandbox") {
  console.error("✖ The smoke test only runs against the sandbox (USCIS_ENV=sandbox).");
  process.exit(1);
}

let tokenRequests = 0;
const countingFetch: typeof fetch = (input, init) => {
  if (String(input).endsWith("/oauth/accesstoken")) tokenRequests++;
  return fetch(input, init);
};

const centralDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * The sandbox's spike arrest allows 5 calls/second with a burst of 1 (one call
 * per 200 ms). Back-to-back tests tripped it, so tests got a 429 instead of
 * USCIS's real answer. Wait this long after the previous test *finishes*: a
 * test that fetches a token makes its case call at the very end.
 */
const MIN_GAP_MS = 300;
let lastEnd = 0;

async function run(test: string, receipt: string, cfg: UscisConfig, skipValidation = false): Promise<Entry> {
  const wait = lastEnd + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    return await runOnce(test, receipt, cfg, skipValidation);
  } finally {
    lastEnd = Date.now();
  }
}

async function runOnce(test: string, receipt: string, cfg: UscisConfig, skipValidation: boolean): Promise<Entry> {
  const now = new Date();
  const before = tokenRequests;
  const started = Date.now();
  const base = { ts: now.toISOString(), dateCentral: centralDate(now), source: "backend-smoke" as const, env: cfg.env, test, receipt };
  try {
    const r = await fetchCaseStatus(cfg, receipt, { fetchImpl: countingFetch, skipValidation, maxRetries: 1 });
    return {
      ...base,
      httpStatus: r.httpStatus,
      outcome: "ok",
      attempts: r.attempts,
      durationMs: r.durationMs,
      tokenRequests: tokenRequests - before,
      formType: r.snapshot.formType,
      statusTitleEn: r.snapshot.status.en.title,
      hasHistory: r.snapshot.hasHistory,
    };
  } catch (err) {
    const e = err instanceof UscisError ? err : new UscisError("network", String(err));
    errorBodies.set(test, e.responseBody);
    return {
      ...base,
      httpStatus: e.httpStatus,
      outcome: e.kind,
      attempts: null,
      durationMs: Date.now() - started,
      tokenRequests: tokenRequests - before,
      errorCodes: e.details.map((d) => d.code).filter((c): c is string => Boolean(c)),
      errorMessage: e.details.find((d) => d.message)?.message,
    };
  }
}

async function main() {
  const entries: Entry[] = [];
  entries.push(await run("success-no-history", SANDBOX_RECEIPTS.noHistory, config));
  entries.push(await run("success-with-history", SANDBOX_RECEIPTS.withHistory, config));
  // Second call should reuse the cached token (tokenRequests = 0).
  entries.push(await run("token-reuse", SANDBOX_RECEIPTS.noHistory, config));
  // Deliberately malformed — must come back as a handled USCIS 4xx.
  entries.push(await run("error-invalid-receipt", "INVALID", config, true));
  if (withAuthError) {
    const bad = { ...config, clientSecret: "deliberately-wrong-secret" };
    clearUscisTokenCache(bad);
    entries.push(await run("error-bad-credentials", SANDBOX_RECEIPTS.noHistory, bad));
  }

  const dir = join(process.cwd(), "docs", "uscis-evidence");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${entries[0].dateCentral.slice(0, 7)}.jsonl`);
  appendFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");

  console.table(
    entries.map((e) => ({
      test: e.test,
      receipt: e.receipt,
      http: e.httpStatus ?? "-",
      outcome: e.outcome,
      tokens: e.tokenRequests,
      ms: e.durationMs,
      status: e.statusTitleEn ?? (e.errorCodes?.join(",") || e.errorMessage?.slice(0, 60) || ""),
    })),
  );
  console.log(`Logged ${entries.length} entries to ${file}`);

  if (showErrors) {
    for (const [test, body] of errorBodies) {
      console.log(`\n--- USCIS error body for "${test}" (console only, not logged) ---`);
      console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    }
  }

  const expectations: Record<string, (e: Entry) => boolean> = {
    "success-no-history": (e) => e.httpStatus === 200,
    "success-with-history": (e) => e.httpStatus === 200,
    "token-reuse": (e) => e.httpStatus === 200 && e.tokenRequests === 0,
    "error-invalid-receipt": (e) => e.httpStatus !== null && e.httpStatus >= 400 && e.httpStatus < 500,
    "error-bad-credentials": (e) => e.httpStatus === 401 || e.httpStatus === 403 || e.httpStatus === 400,
  };
  const failed = entries.filter((e) => !expectations[e.test]?.(e));
  if (failed.length) {
    console.error(`✖ Unexpected result for: ${failed.map((e) => e.test).join(", ")}`);
    process.exit(1);
  }
  console.log("✔ All sandbox checks behaved as expected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
