import { describe, expect, it } from "vitest";
// The app's court-case helpers are plain TypeScript (no phone APIs), so they're tested here.
import { autoSlash, daysUntil, formatANumber, maskANumber, parseTime, parseUsDate, reminderTimes, validANumber } from "../../../mobile/src/lib/court-dates";

describe("court cases on the phone", () => {
  it("formats and masks A-Numbers, and wants all 9 digits", () => {
    expect(formatANumber("012345678")).toBe("A-012-345-678");
    expect(maskANumber("012345678")).toBe("A-•••-•••-678");
    expect(validANumber("012345678")).toBe(true);
    expect(validANumber("12345678")).toBe(false);
    expect(validANumber("01234567x")).toBe(false);
  });

  it("reads US dates and 12-hour times, and types the slashes", () => {
    expect(parseUsDate("12/03/2026")).toBe("2026-12-03");
    expect(parseUsDate("2/3/2026")).toBe("2026-02-03");
    expect(parseUsDate("02/30/2026")).toBeNull();
    expect(parseUsDate("2026-12-03")).toBeNull();
    expect(parseTime("9:30", "AM")).toBe("09:30");
    expect(parseTime("12:00", "AM")).toBe("00:00");
    expect(parseTime("12:15", "PM")).toBe("12:15");
    expect(parseTime("1", "PM")).toBe("13:00");
    expect(parseTime("13:00", "PM")).toBeNull();
    expect(parseTime("9:75", "AM")).toBeNull();
    expect(autoSlash("12032026")).toBe("12/03/2026");
    expect(autoSlash("120")).toBe("12/0");
    expect(autoSlash("12/03/20261")).toBe("12/03/2026");
  });

  it("counts days to the hearing and reminds a week before, the day before and 2 hours before", () => {
    const now = new Date(2026, 10, 7, 15, 0); // Nov 7, 3 PM local
    expect(daysUntil("2026-12-03T09:30", now)).toBe(26);
    expect(daysUntil("2026-11-07T17:00", now)).toBe(0);
    expect(daysUntil("2026-11-06T09:00", now)).toBe(-1);
    const r = reminderTimes("2026-12-03T09:30", now);
    expect(r.map((x) => x.kind)).toEqual(["week", "day", "soon"]);
    expect(r[0].when).toEqual(new Date(2026, 10, 26, 9, 0));
    expect(r[1].when).toEqual(new Date(2026, 11, 2, 9, 0));
    expect(r[2].when).toEqual(new Date(2026, 11, 3, 7, 30));
    // Only reminders still ahead: tomorrow morning's hearing gets the 2-hours-before one (and the day-before one has passed).
    expect(reminderTimes("2026-11-08T10:00", now).map((x) => x.kind)).toEqual(["soon"]);
  });
});
