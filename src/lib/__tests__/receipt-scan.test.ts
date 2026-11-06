import { describe, expect, it } from "vitest";
// The app's receipt finder (plain TypeScript), checked here with the website's tests.
import { findReceiptNumbers } from "../../../mobile/src/lib/receipt-scan";

// Lines as Apple Vision / Google ML Kit return them for a photographed I-797C notice (test values).
const NOTICE = [
  "THE UNITED STATES OF AMERICA",
  "Receipt Number",
  "Case Type",
  "IOE0912345678",
  "I130 - PETITION FOR ALIEN RELATIVE",
  "Received Date Priority Date Page",
  "10/05/2025 10/05/2025 1 of 1",
  "Applicant A123 456 789",
  "Notice Type: Receipt Notice",
  "Amount received: $675.00 U.S.",
  "If you have questions, call 1-800-375-5283.",
];

describe("findReceiptNumbers", () => {
  it("finds the receipt number on a notice and ignores A-numbers, dates, fees and phone numbers", () => {
    expect(findReceiptNumbers(NOTICE)).toEqual(["IOE0912345678"]);
  });

  it("fixes look-alike characters text recognition mixes up", () => {
    expect(findReceiptNumbers("Receipt Number I0E0912345678")).toEqual(["IOE0912345678"]);
    expect(findReceiptNumbers("10E09123456 78")).toEqual(["IOE0912345678"]);
    expect(findReceiptNumbers("EAC2I9OO12345")).toEqual(["EAC2190012345"]);
    expect(findReceiptNumbers("wac-2190012345")).toEqual(["WAC2190012345"]);
    expect(findReceiptNumbers("LIN 219 001 2345")).toEqual(["LIN2190012345"]);
  });

  it("reads text blocks with several lines (Android) and merges repeats", () => {
    expect(findReceiptNumbers(["Receipt Number\nEAC9999103402", "Your receipt number is EAC9999103402."])).toEqual(["EAC9999103402"]);
  });

  it("puts known office codes and numbers next to 'Receipt' first", () => {
    expect(findReceiptNumbers(["Reference QQQ1234567890", "Receipt Number", "MSC2190012345"])).toEqual(["MSC2190012345", "QQQ1234567890"]);
  });

  it("never treats words or wrong lengths as receipt numbers", () => {
    expect(findReceiptNumbers("THE SOLID BLOGS DOLLS ISLAND")).toEqual([]);
    expect(findReceiptNumbers("IOE091234567")).toEqual([]); // 9 digits
    expect(findReceiptNumbers("IOE09123456789")).toEqual([]); // 11 digits
    expect(findReceiptNumbers("")).toEqual([]);
  });
});
