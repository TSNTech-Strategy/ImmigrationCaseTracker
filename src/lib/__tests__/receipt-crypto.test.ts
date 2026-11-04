import { beforeAll, describe, expect, it } from "vitest";
import { isValidReceiptNumber, maskReceiptNumber, normalizeReceiptNumber } from "../receipt";
import { decrypt, digest, encrypt } from "../crypto";

describe("receipt numbers", () => {
  it("normalizes pasted input", () => {
    expect(normalizeReceiptNumber(" eac-999 9103402 ")).toBe("EAC9999103402");
  });
  it("validates 3 letters + 10 digits", () => {
    expect(isValidReceiptNumber("EAC9999103402")).toBe(true);
    expect(isValidReceiptNumber("IOE0912345678")).toBe(true);
    expect(isValidReceiptNumber("EAC999910340")).toBe(false);
    expect(isValidReceiptNumber("E1C9999103402")).toBe(false);
    expect(isValidReceiptNumber("INVALID")).toBe(false);
  });
  it("masks for logs", () => {
    expect(maskReceiptNumber("EAC9999103402")).toBe("EAC*******402");
  });
});

describe("crypto", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("EAC9999103402");
    expect(a).not.toBe(encrypt("EAC9999103402"));
    expect(decrypt(a)).toBe("EAC9999103402");
  });
  it("detects tampering", () => {
    const [iv, tag, ct] = encrypt("EAC9999103402").split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });
  it("digest is deterministic, keyed and not the plaintext", () => {
    expect(digest("EAC9999103402")).toBe(digest("EAC9999103402"));
    expect(digest("EAC9999103402")).not.toContain("9999103402");
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    const other = digest("EAC9999103402");
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(other).not.toBe(digest("EAC9999103402"));
  });
});
