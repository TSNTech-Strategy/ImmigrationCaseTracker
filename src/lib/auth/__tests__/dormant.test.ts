import { describe, expect, it } from "vitest";
import { DORMANT_GRACE_DAYS, dormancyAction, dormantCutoff, lastSeenUpdate } from "../dormant";
import { dormantAccountEmail } from "@/lib/email/templates";

const now = new Date("2029-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("dormant accounts", () => {
  it("cuts off at 24 months", () => {
    expect(dormantCutoff(now).toISOString()).toBe("2027-06-15T12:00:00.000Z");
  });

  it("warns an account unused for 24 months, measured from the last sign-in", () => {
    expect(dormancyAction({ lastSeenAt: new Date("2027-06-15T12:00:00Z"), createdAt: daysAgo(2000), dormantNoticeAt: null }, now)).toBe("warn");
    expect(dormancyAction({ lastSeenAt: new Date("2027-06-16T12:00:00Z"), createdAt: daysAgo(2000), dormantNoticeAt: null }, now)).toBeNull();
  });

  it("falls back to the sign-up date when there's no recorded sign-in", () => {
    expect(dormancyAction({ lastSeenAt: null, createdAt: new Date("2027-01-01T00:00:00Z"), dormantNoticeAt: null }, now)).toBe("warn");
    expect(dormancyAction({ lastSeenAt: null, createdAt: daysAgo(30), dormantNoticeAt: null }, now)).toBeNull();
  });

  it("deletes only after the 30-day grace period", () => {
    const old = new Date("2026-01-01T00:00:00Z");
    expect(dormancyAction({ lastSeenAt: old, createdAt: old, dormantNoticeAt: daysAgo(DORMANT_GRACE_DAYS - 1) }, now)).toBeNull();
    expect(dormancyAction({ lastSeenAt: old, createdAt: old, dormantNoticeAt: daysAgo(DORMANT_GRACE_DAYS) }, now)).toBe("delete");
  });

  it("never deletes someone who signed in after the warning", () => {
    expect(dormancyAction({ lastSeenAt: daysAgo(10), createdAt: daysAgo(2000), dormantNoticeAt: daysAgo(40) }, now)).toBeNull();
  });

  it("writes lastSeenAt at most once a day, and a sign-in clears the warning", () => {
    expect(lastSeenUpdate({ lastSeenAt: null, dormantNoticeAt: null }, now)).toEqual({ lastSeenAt: now, dormantNoticeAt: null });
    expect(lastSeenUpdate({ lastSeenAt: new Date(now.getTime() - 3_600_000), dormantNoticeAt: null }, now)).toBeNull();
    expect(lastSeenUpdate({ lastSeenAt: daysAgo(2), dormantNoticeAt: null }, now)).toEqual({ lastSeenAt: now, dormantNoticeAt: null });
    expect(lastSeenUpdate({ lastSeenAt: new Date(now.getTime() - 60_000), dormantNoticeAt: daysAgo(5) }, now)).toEqual({ lastSeenAt: now, dormantNoticeAt: null });
  });

  it("warning email gives the deletion date and a sign-in link", () => {
    const m = dormantAccountEmail({ to: "a@test.dev", name: "Ana", deleteOn: new Date("2029-07-15T12:00:00Z"), signInUrl: "https://casepingo.test/login" });
    expect(m.subject).toMatch(/deleted unless you sign in/);
    expect(m.body).toContain("July 15, 2029");
    expect(m.body).toContain("https://casepingo.test/login");
  });
});
