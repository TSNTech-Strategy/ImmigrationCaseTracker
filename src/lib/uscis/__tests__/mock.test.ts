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
});
