import { describe, expect, it } from "vitest";
import { pastedReceiptsToCsv, receiptsInText } from "../firms/import";
import { parseCsv } from "../csv";

describe("receipt numbers in pasted text", () => {
  it("finds every receipt number in any text, with spaces or dashes, once each", () => {
    const text = "Hi team, cases: EAC 99 991-03402 and ioe0912345678.\nAlso WAC2312345678, EAC9999103402 again. Not this: ABC123, EAC12345678901234.";
    expect(receiptsInText(text)).toEqual(["EAC9999103402", "IOE0912345678", "WAC2312345678"]);
    expect(receiptsInText("nothing here")).toEqual([]);
  });

  it("turns pasted receipts into import rows for one client, quoting names safely", () => {
    const { csv, count } = pastedReceiptsToCsv("EAC9999103402\nIOE0912345678", 'Lopez, "Mia"', "M-7");
    expect(count).toBe(2);
    expect(parseCsv(csv)).toEqual([
      ["client_name", "client_ref", "receipt_number"],
      ['Lopez, "Mia"', "M-7", "EAC9999103402"],
      ['Lopez, "Mia"', "M-7", "IOE0912345678"],
    ]);
  });

  it("reads tab-separated text (copied from a spreadsheet)", () => {
    expect(parseCsv("Client\tReceipt\nAna Ruiz\tEAC9999103402\n")).toEqual([
      ["Client", "Receipt"],
      ["Ana Ruiz", "EAC9999103402"],
    ]);
  });
});
