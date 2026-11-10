import { describe, expect, it } from "vitest";
import { mockFetchCaseStatus } from "../mock";

describe("mock USCIS", () => {
  it("mirrors the staging receipts", async () => {
    expect((await mockFetchCaseStatus("EAC9999103402")).snapshot.status.en.title).toBe("Case Approval Was Affirmed");
    expect((await mockFetchCaseStatus("EAC9999103403")).snapshot.hasHistory).toBe(true);
  });
  it("is deterministic", async () => {
    const a = await mockFetchCaseStatus("IOE1234567812");
    const b = await mockFetchCaseStatus("IOE1234567812");
    expect(a.snapshot.fingerprint).toBe(b.snapshot.fingerprint);
  });
  it("simulates error receipts", async () => {
    await expect(mockFetchCaseStatus("EAC0000000404")).rejects.toMatchObject({ kind: "not_found" });
    await expect(mockFetchCaseStatus("EAC0000000429")).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(mockFetchCaseStatus("EAC0000000500")).rejects.toMatchObject({ kind: "server" });
    await expect(mockFetchCaseStatus("bad")).rejects.toMatchObject({ kind: "invalid_receipt" });
  });
  it("returns every documented Case Status API error with USCIS's documented message", async () => {
    const cases: [string, string, number, RegExp][] = [
      ["EAC0000000401", "auth", 401, /^Invalid Access Token$/],
      ["EAC0000000404", "not_found", 404, /does not recognize the receipt number/],
      ["EAC0000000422", "bad_request", 422, /not formatted correctly/],
      ["EAC0000000429", "rate_limited", 429, /^Spike Arrest Violation$/],
      ["EAC0000000500", "server", 503, /^Service Unavailable$/],
    ];
    for (const [receipt, kind, httpStatus, message] of cases) {
      const err = await mockFetchCaseStatus(receipt).catch((e) => e);
      expect(err).toMatchObject({ kind, httpStatus });
      expect(err.uscisMessage).toMatch(message);
    }
  });
});
