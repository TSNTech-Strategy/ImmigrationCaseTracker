import { describe, expect, it } from "vitest";
import { FIRM_PLANS, formatUsd, perMonth, PLAN_LIMITS, PRICES } from "../plans";

describe("launch prices", () => {
  it("keeps the yearly plan well below 12 monthly payments", () => {
    expect(PRICES.premium.yearly).toBeLessThan(PRICES.premium.monthly * 12 * 0.65);
  });
  it("stays at or below the cheapest major competitor's yearly price we found ($29.99, Nov 2026)", () => {
    expect(PRICES.premium.yearly).toBeLessThanOrEqual(29.99);
  });
  it("formats prices", () => {
    expect(formatUsd(3.99)).toBe("$3.99");
    expect(formatUsd(29)).toBe("$29");
    expect(perMonth(29)).toBe("$2.41");
  });
  it("matches the plan limits", () => {
    expect(PLAN_LIMITS.PREMIUM.maxCases).toBe(10);
    expect(FIRM_PLANS.SOLO).toMatchObject({ maxCases: 50, maxUsers: 2 });
    expect(FIRM_PLANS.FIRM).toMatchObject({ maxCases: 300, maxUsers: null });
  });
});
