import { isValidReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import type { UscisConfig } from "./config";
import { UscisError, kindForStatus, parseErrorDetails } from "./errors";
import { normalizeCaseStatus, type CaseStatusSnapshot } from "./normalize";
import { clearUscisTokenCache, getUscisAccessToken, networkError } from "./token";

export type CaseStatusResult = {
  snapshot: CaseStatusSnapshot;
  httpStatus: number;
  attempts: number;
  durationMs: number;
};

export type FetchCaseStatusOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Retries for 5xx / timeout / network only. 4xx is never retried. */
  maxRetries?: number;
  /** Base delay for exponential backoff with jitter. */
  backoffMs?: number;
  /**
   * Send the value as-is, skipping our receipt-format check. Only for the
   * sandbox smoke test, which must provoke a genuine USCIS 4xx.
   */
  skipValidation?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET /case-status/{receipt} through our backend.
 *
 * Callers are responsible for authorization and consent (is this user allowed
 * to track this receipt?) before calling — this function only talks to USCIS.
 */
export async function fetchCaseStatus(
  config: UscisConfig,
  receiptInput: string,
  opts: FetchCaseStatusOptions = {},
): Promise<CaseStatusResult> {
  const { fetchImpl = fetch, timeoutMs = 10_000, maxRetries = 2, backoffMs = 500 } = opts;
  const receipt = opts.skipValidation ? receiptInput : normalizeReceiptNumber(receiptInput);
  if (!opts.skipValidation && !isValidReceiptNumber(receipt)) {
    throw new UscisError("invalid_receipt", "Receipt number must be 3 letters followed by 10 digits");
  }

  const started = Date.now();
  let attempts = 0;
  let refreshedToken = false;

  for (;;) {
    attempts++;
    try {
      const token = await getUscisAccessToken(config, { fetchImpl, timeoutMs });
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      if (config.demoId) headers.demo_id = config.demoId;

      let res: Response;
      try {
        res = await fetchImpl(`${config.baseUrl}/case-status/${encodeURIComponent(receipt)}`, {
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (err) {
        throw networkError(err, "USCIS case-status request failed");
      }

      const body: unknown = await res.json().catch(() => null);

      if (res.ok) {
        try {
          return { snapshot: normalizeCaseStatus(body, receipt), httpStatus: res.status, attempts, durationMs: Date.now() - started };
        } catch (err) {
          throw new UscisError("bad_response", (err as Error).message, { httpStatus: res.status });
        }
      }

      // A rejected token: drop it and try once more with a fresh one.
      if (res.status === 401 && !refreshedToken) {
        refreshedToken = true;
        clearUscisTokenCache(config);
        attempts--; // not a retry of the same failure
        continue;
      }

      const retryAfter = Number(res.headers.get("retry-after"));
      throw new UscisError(kindForStatus(res.status), `USCIS case-status HTTP ${res.status}`, {
        httpStatus: res.status,
        details: parseErrorDetails(body),
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      });
    } catch (err) {
      const e = err instanceof UscisError ? err : new UscisError("network", (err as Error)?.message ?? "unknown error");
      // Rate limiting is retried by the scheduler later, not in a tight loop here.
      const retryable = e.kind === "server" || e.kind === "timeout" || e.kind === "network";
      if (!retryable || attempts > maxRetries) throw e;
      const delay = backoffMs * 2 ** (attempts - 1);
      await sleep(delay / 2 + Math.random() * (delay / 2));
    }
  }
}
