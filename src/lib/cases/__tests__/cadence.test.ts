import { describe, expect, it } from "vitest";
import { cadenceTier, checksPerDay, nextCheckDelayMs } from "../cadence";

const now = new Date("2027-03-01T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const at = (title: string | null, changedDaysAgo: number | null, addedDaysAgo = 400) => ({
  statusTitleEn: title,
  lastChangeObservedAt: changedDaysAgo === null ? null : daysAgo(changedDaysAgo),
  createdAt: daysAgo(addedDaysAgo),
});

describe("check cadence", () => {
  it("checks moving cases often and long waits less often", () => {
    expect(cadenceTier(at(null, null, 0), now)).toBe("active"); // never checked
    expect(cadenceTier(at("Case Was Received", null, 3), now)).toBe("active"); // just added
    expect(cadenceTier(at("Case Is Being Actively Reviewed By USCIS", 5), now)).toBe("active"); // changed this week
    expect(cadenceTier(at("Case Is Being Actively Reviewed By USCIS", 30), now)).toBe("steady");
    expect(cadenceTier(at("Case Was Received", 200), now)).toBe("quiet");
    expect(cadenceTier(at("Case Was Received", null, 200), now)).toBe("quiet"); // added long ago, never changed
  });
  it("keeps fast-moving steps active and finished cases weekly", () => {
    expect(cadenceTier(at("Interview Was Scheduled", 60), now)).toBe("active");
    expect(cadenceTier(at("Request for Evidence Was Sent", 40), now)).toBe("active");
    expect(cadenceTier(at("Card Was Mailed To Me", 20), now)).toBe("active");
    expect(cadenceTier(at("Card Was Delivered To Me By The Post Office", 30), now)).toBe("settled");
    expect(cadenceTier(at("Case Was Denied", 30), now)).toBe("settled");
    // A finished case that changed days ago is still watched closely (e.g. a reopening).
    expect(cadenceTier(at("Case Was Denied", 2), now)).toBe("active");
  });
  it("turns tiers into delays with a small spread, never below the plan's floor", () => {
    const mid = () => 0.5;
    expect(nextCheckDelayMs(at("Interview Was Scheduled", 60), now, { random: mid })).toBe(12 * 3_600_000);
    expect(nextCheckDelayMs(at("Case Was Received", 200), now, { random: mid })).toBe(48 * 3_600_000);
    expect(nextCheckDelayMs(at("Case Was Denied", 30), now, { random: mid })).toBe(168 * 3_600_000);
    expect(nextCheckDelayMs(at("Interview Was Scheduled", 60), now, { random: () => 0 })).toBe(Math.round(12 * 0.9 * 3_600_000));
    expect(nextCheckDelayMs(at("Interview Was Scheduled", 60), now, { random: () => 1 })).toBe(Math.round(12 * 1.1 * 3_600_000));
    expect(nextCheckDelayMs(at("Interview Was Scheduled", 60), now, { minHours: 24, random: mid })).toBe(24 * 3_600_000);
    expect(checksPerDay(at("Case Was Received", 200), now)).toBe(0.5);
  });
});
