import { beforeAll, describe, expect, it } from "vitest";
import { InvalidReceiptError, protectReceipt, receiptDigestOf, revealReceipt } from "../receipt-store";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
});

describe("receipt store", () => {
  it("produces encrypted, digest and masked forms — none containing the receipt", () => {
    const p = protectReceipt("eac 9999103402");
    expect(p.receiptMasked).toBe("EAC*******402");
    expect(p.receiptEncrypted).not.toContain("9999103402");
    expect(p.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(revealReceipt(p)).toBe("EAC9999103402");
  });
  it("gives the same digest for differently formatted input", () => {
    expect(receiptDigestOf("EAC-9999-103402")).toBe(protectReceipt("eac9999103402").receiptDigest);
  });
  it("rejects invalid receipts", () => {
    expect(() => protectReceipt("123")).toThrow(InvalidReceiptError);
  });
});
