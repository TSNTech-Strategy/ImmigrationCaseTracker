import { describe, expect, it } from "vitest";
import { onRealSandbox, sandboxClosedNow, sandboxOpen } from "../sandbox-hours";

const real = { USCIS_CLIENT_ID: "id", USCIS_CLIENT_SECRET: "s", USCIS_ENV: "sandbox" };

describe("USCIS test system hours (weekdays 7 AM to 8 PM Eastern)", () => {
  it("knows when it's open, across daylight saving time", () => {
    expect(sandboxOpen(new Date("2026-11-11T10:22:00Z"))).toBe(false); // Wed 5:22 AM EST
    expect(sandboxOpen(new Date("2026-11-11T12:00:00Z"))).toBe(true); // Wed 7:00 AM EST
    expect(sandboxOpen(new Date("2026-11-10T00:59:00Z"))).toBe(true); // Mon 7:59 PM EST
    expect(sandboxOpen(new Date("2026-11-10T01:00:00Z"))).toBe(false); // Mon 8:00 PM EST
    expect(sandboxOpen(new Date("2026-07-15T11:00:00Z"))).toBe(true); // Wed 7:00 AM EDT
    expect(sandboxOpen(new Date("2026-07-15T10:59:00Z"))).toBe(false);
    expect(sandboxOpen(new Date("2026-11-14T16:00:00Z"))).toBe(false); // Saturday
    expect(sandboxOpen(new Date("2026-11-15T16:00:00Z"))).toBe(false); // Sunday
  });
  it("only pauses real sandbox calls (not mock mode, not production)", () => {
    const night = new Date("2026-11-11T08:00:00Z");
    expect(onRealSandbox(real)).toBe(true);
    expect(sandboxClosedNow(night, real)).toBe(true);
    expect(sandboxClosedNow(new Date("2026-11-11T15:00:00Z"), real)).toBe(false);
    expect(sandboxClosedNow(night, { ...real, USCIS_ENV: "production" })).toBe(false);
    expect(sandboxClosedNow(night, {})).toBe(false); // mock mode (no credentials)
    expect(sandboxClosedNow(night, { ...real, MOCK_USCIS: "true" })).toBe(false);
  });
});
