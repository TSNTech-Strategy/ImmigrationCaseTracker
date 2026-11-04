// Pure helpers shared by the proxy, pages and actions (no server imports).

/** Areas that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/cases", "/settings", "/firm", "/admin", "/reset-password"] as const;

/** Sign-in pages a signed-in user doesn't need. */
export const AUTH_PAGES = ["/login", "/signup", "/forgot-password"] as const;

export const DEFAULT_AFTER_LOGIN = "/cases";

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtectedPath = (pathname: string) => PROTECTED_PREFIXES.some((p) => matches(pathname, p));
// Exact match: /login/mfa is NOT a sign-in page — a half-signed-in user must reach it.
export const isAuthPage = (pathname: string) => (AUTH_PAGES as readonly string[]).includes(pathname);

/**
 * Only same-site relative paths are allowed as a post-login destination —
 * never "//evil.com", "https://…" or "/\evil.com" (open-redirect protection).
 */
export function safeNextPath(next: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    const u = new URL(next, "http://x");
    if (u.origin !== "http://x") return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

/** "Authorization: Bearer <token>" → token, else null. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return m ? m[1] : null;
}
