import { describe, expect, it } from "vitest";
import { csvCell, parseCsv } from "../csv";

describe("parseCsv", () => {
  it("reads quoted fields, escaped quotes, CRLF, BOM and skips blank lines", () => {
    const text = '﻿client,receipt,label\r\n"Lopez, Maria",EAC9999103402,"Her ""I-130"""\r\n\r\nJohn Doe , eac9999103403 ,\n';
    expect(parseCsv(text)).toEqual([
      ["client", "receipt", "label"],
      ["Lopez, Maria", "EAC9999103402", 'Her "I-130"'],
      ["John Doe", "eac9999103403", ""],
    ]);
  });
  it("detects semicolon-separated files (Excel in many locales)", () => {
    expect(parseCsv("client;receipt\nMaria;EAC9999103402")).toEqual([["client", "receipt"], ["Maria", "EAC9999103402"]]);
  });
  it("keeps newlines inside quotes and handles a missing final newline", () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([["a", "b"], ["line1\nline2", "x"]]);
  });
});

describe("csvCell", () => {
  it("quotes separators and neutralizes formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
