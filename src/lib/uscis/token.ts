import type { UscisConfig } from "./config";
import { UscisError, kindForStatus, parseErrorDetails } from "./errors";

// OAuth 2.0 client-credentials token, cached in server memory until shortly
// before it expires (USCIS tokens last ~30 minutes). Same shape as Scanvio's
// SP-API access-token cache: concurrent callers share one in-flight request,
// and a failed request is not cached. Tokens are never persisted or logged.

type CachedToken = { token: string; expiresAt: number };

const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_LIFETIME_S = 1800;
const tokens = new Map<string, Promise<CachedToken>>();

const cacheKey = (c: UscisConfig) => `${c.baseUrl}|${c.clientId}`;

/** Test hook / used after a 401: forget cached tokens. */
export function clearUscisTokenCache(config?: UscisConfig): void {
  if (config) tokens.delete(cacheKey(config));
  else tokens.clear();
}

export async function getUscisAccessToken(
  config: UscisConfig,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<string> {
  const key = cacheKey(config);
  const existing = tokens.get(key);
  if (existing) {
    const cached = await existing.catch(() => null);
    if (cached && Date.now() < cached.expiresAt) return cached.token;
    // Expired or failed — only clear it if nobody replaced it meanwhile.
    if (tokens.get(key) === existing) tokens.delete(key);
    const replaced = tokens.get(key);
    if (replaced) return (await replaced).token;
  }

  const pending = requestToken(config, opts);
  tokens.set(key, pending);
  pending.catch(() => {
    if (tokens.get(key) === pending) tokens.delete(key);
  });
  return (await pending).token;
}

async function requestToken(
  config: UscisConfig,
  { fetchImpl = fetch, timeoutMs = 10_000 }: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<CachedToken> {
  let res: Response;
  try {
    res = await fetchImpl(`${config.baseUrl}/oauth/accesstoken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    throw networkError(err, "USCIS OAuth request failed");
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new UscisError(kindForStatus(res.status), `USCIS OAuth HTTP ${res.status}`, {
      httpStatus: res.status,
      details: parseErrorDetails(body),
    });
  }
  const o = (body ?? {}) as { access_token?: unknown; expires_in?: unknown };
  if (typeof o.access_token !== "string" || !o.access_token) {
    throw new UscisError("bad_response", "USCIS OAuth response had no access_token", { httpStatus: res.status });
  }
  // Apigee-style responses send expires_in as a string ("1799").
  const lifetime = Number(o.expires_in);
  const seconds = Number.isFinite(lifetime) && lifetime > 0 ? lifetime : DEFAULT_LIFETIME_S;
  return { token: o.access_token, expiresAt: Date.now() + seconds * 1000 - EXPIRY_SKEW_MS };
}

export function networkError(err: unknown, prefix: string): UscisError {
  const name = (err as { name?: string })?.name;
  if (name === "TimeoutError" || name === "AbortError") return new UscisError("timeout", `${prefix}: timed out`);
  return new UscisError("network", `${prefix}: ${(err as Error)?.message ?? "network error"}`);
}
