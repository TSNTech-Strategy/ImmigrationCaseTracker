export type UscisErrorKind =
  | "not_configured" // credentials missing
  | "invalid_receipt" // rejected by our own validation, never sent
  | "auth" // 401/403, including OAuth token failures
  | "bad_request" // other 4xx (USCIS validation, unknown receipt, …)
  | "not_found" // 404
  | "rate_limited" // 429
  | "server" // 5xx
  | "timeout"
  | "network"
  | "bad_response"; // 2xx we couldn't parse

/** A USCIS error code/message pair from the JSON error body — never a token. */
export type UscisApiErrorDetail = { code?: string; message?: string; category?: string };

export class UscisError extends Error {
  readonly kind: UscisErrorKind;
  readonly httpStatus: number | null;
  readonly details: UscisApiErrorDetail[];
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: UscisErrorKind,
    message: string,
    opts: { httpStatus?: number | null; details?: UscisApiErrorDetail[]; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = "UscisError";
    this.kind = kind;
    this.httpStatus = opts.httpStatus ?? null;
    this.details = opts.details ?? [];
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
  }

  /** Worth retrying later without changing anything. */
  get transient(): boolean {
    return this.kind === "server" || this.kind === "timeout" || this.kind === "network" || this.kind === "rate_limited";
  }
}

export function kindForStatus(status: number): UscisErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "bad_request";
}

/** Pull `errors[]` out of a USCIS error body, keeping only safe fields. */
export function parseErrorDetails(body: unknown): UscisApiErrorDetail[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.slice(0, 5).map((e) => {
    const o = (e ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, 300) : undefined);
    return { code: str(o.code), message: str(o.message), category: str(o.category) };
  });
}
