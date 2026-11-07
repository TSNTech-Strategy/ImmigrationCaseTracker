import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// AES-256-GCM for sensitive values at rest (receipt numbers), same scheme as
// Scanvio. ENCRYPTION_KEY is a base64-encoded 32-byte key
// (openssl rand -base64 32), held only as a server-side environment variable.

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return buf;
}

/** Separate sub-keys per purpose, so the digest key is never the cipher key. */
function subKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), purpose, 32));
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subKey("ict/encrypt/v1"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, ciphertext] = token.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", subKey("ict/encrypt/v1"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Keyed, deterministic digest — lets us find duplicates ("is this receipt
 * already tracked by this account?") without storing or indexing the raw
 * receipt number. Callers should normalize the input first.
 */
export function digest(value: string): string {
  return createHmac("sha256", subKey("ict/digest/v1")).update(value).digest("hex");
}

/** A keyed signature for links that must not be guessable or editable (base64url, 24 bytes). */
export function sign(purpose: string, value: string): string {
  return createHmac("sha256", subKey(purpose)).update(value).digest().subarray(0, 24).toString("base64url");
}
