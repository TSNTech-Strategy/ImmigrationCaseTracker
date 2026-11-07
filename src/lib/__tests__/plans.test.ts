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
    expect(PLAN_LIMITS.FREE.assistantPerDay).toBeLessThan(PLAN_LIMITS.PREMIUM.assistantPerDay);
    expect(FIRM_PLANS.SOLO).toMatchObject({ maxCases: 150, maxUsers: 2, price: 49 });
    expect(FIRM_PLANS.FIRM).toMatchObject({ maxCases: 600, maxUsers: 10, price: 129 });
    expect(FIRM_PLANS.PLUS).toMatchObject({ maxCases: 2000, maxUsers: null, price: 249 });
  });
  it("gives firms 2 months free when they pay yearly", () => {
    for (const p of Object.values(FIRM_PLANS)) expect(p.yearly).toBe(p.price * 10);
  });
});

describe("money formatting", () => {
  it("groups thousands", () => {
    expect(formatUsd(1290)).toBe("$1,290");
    expect(formatUsd(107.5)).toBe("$107.50");
  });
});
