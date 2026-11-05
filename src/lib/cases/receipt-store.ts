import { decrypt, digest, encrypt } from "@/lib/crypto";
import { isValidReceiptNumber, maskReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";

/** The three stored forms of a receipt number. The plain value is never stored. */
export type ProtectedReceipt = {
  receiptEncrypted: string;
  receiptDigest: string;
  receiptMasked: string;
};

export class InvalidReceiptError extends Error {
  constructor() {
    super("Receipt number must be 3 letters followed by 10 digits (e.g. EAC9999103402).");
    this.name = "InvalidReceiptError";
  }
}

export function protectReceipt(input: string): ProtectedReceipt {
  const receipt = normalizeReceiptNumber(input);
  if (!isValidReceiptNumber(receipt)) throw new InvalidReceiptError();
  return {
    receiptEncrypted: encrypt(receipt),
    receiptDigest: receiptDigestOf(receipt),
    receiptMasked: maskReceiptNumber(receipt),
  };
}

/** Digest for duplicate lookups ("does this account already track it?"). */
export function receiptDigestOf(input: string): string {
  return digest(`receipt:${normalizeReceiptNumber(input)}`);
}

/** Decrypt only at the moment of a USCIS call — never to log or display. */
export function revealReceipt(stored: Pick<ProtectedReceipt, "receiptEncrypted">): string {
  return decrypt(stored.receiptEncrypted);
}
