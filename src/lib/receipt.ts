// USCIS receipt numbers: three letters (the service center / office code,
// e.g. EAC, WAC, LIN, SRC, NBC, MSC, IOE) followed by ten digits.

const RECEIPT_RE = /^[A-Z]{3}\d{10}$/;

/** Uppercase and strip spaces / dashes people paste in ("eac-99 9910 3402"). */
export function normalizeReceiptNumber(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidReceiptNumber(input: string): boolean {
  return RECEIPT_RE.test(normalizeReceiptNumber(input));
}

/**
 * For logs and UI where the full number isn't needed: "EAC*******402".
 * Receipt numbers identify a person's immigration case — logs must never
 * carry the full value.
 */
export function maskReceiptNumber(input: string): string {
  const r = normalizeReceiptNumber(input);
  if (r.length <= 6) return "*".repeat(r.length);
  return `${r.slice(0, 3)}${"*".repeat(r.length - 6)}${r.slice(-3)}`;
}

/**
 * Staging receipts USCIS publishes for the sandbox
 * (https://developer.uscis.gov/api/case-status). Sandbox requests are limited
 * to these — never a real person's number.
 */
export const SANDBOX_RECEIPTS = {
  noHistory: "EAC9999103402",
  withHistory: "EAC9999103403",
} as const;
