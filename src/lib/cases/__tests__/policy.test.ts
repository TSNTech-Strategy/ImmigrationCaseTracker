import { describe, expect, it } from "vitest";
import { checkFailureMessage, cooldownRemainingMs, formatWait, nextCheckAfterFailure, startOfUtcDay, uscisDailyBudget } from "../policy";
import { isSandboxReceipt } from "@/lib/receipt";

const t = new Date("2026-11-05T15:00:00Z");

describe("policy", () => {
  it("cooldown is 10 minutes", () => {
    expect(cooldownRemainingMs(null, t)).toBe(0);
    expect(cooldownRemainingMs(new Date(t.getTime() - 4 * 60_000), t)).toBe(6 * 60_000);
    expect(cooldownRemainingMs(new Date(t.getTime() - 11 * 60_000), t)).toBe(0);
  });
  it("backs off 1h, 2h, 4h … max 24h", () => {
    const h = (n: number) => (nextCheckAfterFailure(t, n).getTime() - t.getTime()) / 3600_000;
    expect([1, 2, 3, 6, 20].map(h)).toEqual([1, 2, 4, 24, 24]);
  });
  it("UTC day start", () => {
    expect(startOfUtcDay(t).toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });
  it("budget from env with safe default", () => {
    expect(uscisDailyBudget({})).toBe(800);
    expect(uscisDailyBudget({ USCIS_DAILY_BUDGET: "50" })).toBe(50);
    expect(uscisDailyBudget({ USCIS_DAILY_BUDGET: "-3" })).toBe(800);
  });
  it("friendly failure messages", () => {
    expect(checkFailureMessage("not_found")).toMatch(/couldn't find/);
    expect(checkFailureMessage("timeout")).toMatch(/couldn't be reached/);
    expect(checkFailureMessage("sandbox_only")).toMatch(/sample receipt/);
  });
  it("formats waits", () => {
    expect(formatWait(30_000)).toBe("about a minute");
    expect(formatWait(6 * 60_000)).toBe("6 minutes");
  });
  it("recognises sandbox receipts, plus configured extras", () => {
    expect(isSandboxReceipt("eac9999103402", {})).toBe(true);
    expect(isSandboxReceipt("IOE0912345678", {})).toBe(false);
    expect(isSandboxReceipt("IOE0912345678", { USCIS_SANDBOX_EXTRA_RECEIPTS: "WAC1, ioe0912345678" })).toBe(true);
  });
});
