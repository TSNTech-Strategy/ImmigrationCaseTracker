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

/**
 * Every staging receipt the Case Status API spec lists (swagger_3.yaml on
 * developer.uscis.gov, Nov 2026), so a demo can run many test cases.
 */
export const SANDBOX_STAGING_RECEIPTS = {
  withHistory: [
    "EAC9999103403", "EAC9999103404", "EAC9999103405", "EAC9999103410", "EAC9999103411", "EAC9999103416", "EAC9999103419",
    "LIN9999106498", "LIN9999106499", "LIN9999106504", "LIN9999106505", "LIN9999106506",
    "SRC9999102777", "SRC9999102778", "SRC9999102779", "SRC9999102780", "SRC9999102781", "SRC9999102782", "SRC9999102783",
    "SRC9999102784", "SRC9999102785", "SRC9999102786", "SRC9999102787", "SRC9999132710", "SRC9999132719",
  ],
  withoutHistory: [
    "EAC9999103400", "EAC9999103402", "EAC9999103406", "EAC9999103407", "EAC9999103408", "EAC9999103409", "EAC9999103412",
    "EAC9999103413", "EAC9999103414", "EAC9999103415", "EAC9999103420", "EAC9999103421", "EAC9999103424", "EAC9999103425",
    "EAC9999103426", "EAC9999103428", "EAC9999103429", "EAC9999103431", "EAC9999103432",
    "LIN9999106501", "LIN9999106507", "SRC9999132694", "SRC9999132695", "SRC9999132706", "SRC9999132707",
  ],
} as const;

const STAGING = new Set<string>([...SANDBOX_STAGING_RECEIPTS.withHistory, ...SANDBOX_STAGING_RECEIPTS.withoutHistory]);

/**
 * Receipts that may be sent to the USCIS *sandbox*: the published staging
 * numbers, plus any others listed in USCIS_SANDBOX_EXTRA_RECEIPTS
 * (comma-separated).
 */
export function isSandboxReceipt(input: string, env: Record<string, string | undefined> = process.env): boolean {
  const r = normalizeReceiptNumber(input);
  const extra = (env.USCIS_SANDBOX_EXTRA_RECEIPTS ?? "")
    .split(",")
    .map((x) => normalizeReceiptNumber(x))
    .filter(Boolean);
  return STAGING.has(r) || extra.includes(r);
}
