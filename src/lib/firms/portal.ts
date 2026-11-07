import { timingSafeEqual } from "node:crypto";
import { sign } from "@/lib/crypto";

/**
 * Client status page links: /status/<token>, read-only, no sign-in.
 *
 * The token is the client id and a version, signed with a key derived from
 * ENCRYPTION_KEY, so nothing secret is stored and staff can copy the link any
 * time. Changing the version (New link) or turning the page off makes every
 * earlier link stop working.
 */

const PURPOSE = "ict/client-portal/v1";

export function portalToken(clientId: string, version: number): string {
  const body = Buffer.from(`${clientId}.${version}`).toString("base64url");
  return `${body}.${sign(PURPOSE, `${clientId}.${version}`)}`;
}

/** The client id and version a token names, or null when it's malformed or the signature doesn't match. */
export function readPortalToken(token: string): { clientId: string; version: number } | null {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined || token.length > 200) return null;
  let plain: string;
  try {
    plain = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const m = /^([a-z0-9]{10,40})\.(\d{1,6})$/.exec(plain);
  if (!m) return null;
  const expected = Buffer.from(sign(PURPOSE, plain));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { clientId: m[1], version: Number(m[2]) };
}

export const portalPath = (clientId: string, version: number) => `/status/${portalToken(clientId, version)}`;
