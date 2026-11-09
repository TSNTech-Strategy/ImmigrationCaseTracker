import "server-only";
import { cookies } from "next/headers";

/**
 * A one-time message for the next page ("Passport.pdf deleted"), carried in a short-lived cookie
 * instead of the address, so names never end up in URLs, history or logs. The toast that shows
 * it clears the cookie, so a refresh or the back button doesn't show it again.
 */
export type Flash = { kind: "success" | "error"; title: string; detail?: string };

export const FLASH_COOKIE = "cp_flash";

/** Long names shortened in the middle, so the extension stays visible. */
export function shortName(name: string, max = 48) {
  if (name.length <= max) return name;
  const keep = Math.floor((max - 1) / 2);
  return `${name.slice(0, keep)}…${name.slice(name.length - keep)}`;
}

export async function setFlash(flash: Flash) {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(flash)), { path: "/", maxAge: 60, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const f = JSON.parse(decodeURIComponent(raw)) as Flash;
    return f && (f.kind === "success" || f.kind === "error") && typeof f.title === "string" ? { kind: f.kind, title: f.title.slice(0, 120), detail: f.detail?.slice(0, 240) } : null;
  } catch {
    return null;
  }
}
