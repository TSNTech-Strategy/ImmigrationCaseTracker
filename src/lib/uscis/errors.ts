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

/**
 * One error from a USCIS JSON error body — never a token. USCIS documents RFC
 * 9457-style fields (code, message, category, reference, status, traceId);
 * reference and traceId identify the request when talking to USCIS support.
 */
export type UscisApiErrorDetail = {
  code?: string;
  message?: string;
  category?: string;
  reference?: string;
  traceId?: string;
};

export class UscisError extends Error {
  readonly kind: UscisErrorKind;
  readonly httpStatus: number | null;
  readonly details: UscisApiErrorDetail[];
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: UscisErrorKind,
    message: string,
    opts: {
      httpStatus?: number | null;
      details?: UscisApiErrorDetail[];
      retryAfterSeconds?: number | null;
      responseBody?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "UscisError";
    this.kind = kind;
    this.httpStatus = opts.httpStatus ?? null;
    this.details = opts.details ?? [];
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    // The raw error body, for diagnostics only (smoke test --show-errors).
    // Non-enumerable so logging or serializing the error never includes it —
    // it may echo the receipt number that was sent.
    Object.defineProperty(this, "responseBody", { value: opts.responseBody, enumerable: false });
  }

  declare readonly responseBody: unknown;

  /** USCIS's own error message, when its error body had one. */
  get uscisMessage(): string | undefined {
    return this.details.find((d) => d.message)?.message;
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

const str = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v).slice(0, 300) : undefined;

function detail(o: Record<string, unknown>): UscisApiErrorDetail {
  return {
    // The sandbox OAuth endpoint capitalizes its keys: { ErrorCode, Error }.
    code: str(o.code ?? o.errorCode ?? o.ErrorCode ?? o.errorcode ?? o.error ?? o.status),
    message: str(o.message ?? o.detail ?? o.error_description ?? o.Error ?? o.title ?? o.faultstring),
    category: str(o.category ?? o.type),
    reference: str(o.reference),
    traceId: str(o.traceId ?? o.traceid ?? o.trace_id),
  };
}

const hasAny = (d: UscisApiErrorDetail) => Boolean(d.code || d.message || d.category);

/**
 * Pull error codes/messages out of a USCIS error body, keeping only safe,
 * short fields. Accepts the documented bare `{ code, message }` and RFC 9457
 * shapes, `{ errors: [...] }`, `{ error: { code, message } }` (the sandbox's
 * 503 outside opening hours), `{ error, error_description }` (OAuth), Apigee
 * `{ fault: { faultstring, detail: { errorcode } } }` and RFC 7807
 * `{ title, detail }`.
 */
export function parseErrorDetails(body: unknown): UscisApiErrorDetail[] {
  if (!body || typeof body !== "object") return [];
  const o = body as Record<string, unknown>;

  if (o.error && typeof o.error === "object" && !Array.isArray(o.error)) {
    const d = detail(o.error as Record<string, unknown>);
    return hasAny(d) ? [d] : [];
  }

  const errors = o.errors;
  if (Array.isArray(errors)) {
    return errors
      .slice(0, 5)
      .map((e) => detail((e ?? {}) as Record<string, unknown>))
      .filter(hasAny);
  }
  if (errors && typeof errors === "object") {
    const d = detail(errors as Record<string, unknown>);
    return hasAny(d) ? [d] : [];
  }

  const fault = o.fault;
  if (fault && typeof fault === "object") {
    const f = fault as Record<string, unknown>;
    const inner = (f.detail ?? {}) as Record<string, unknown>;
    const d = { code: str(inner.errorcode ?? inner.errorCode), message: str(f.faultstring), category: undefined };
    return hasAny(d) ? [d] : [];
  }

  const d = detail(o);
  return hasAny(d) ? [d] : [];
}

/** Read a response body as JSON when possible, else as (truncated) text. */
export async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}
