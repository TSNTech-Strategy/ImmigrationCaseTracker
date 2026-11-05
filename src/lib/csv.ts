/**
 * Minimal RFC 4180 CSV reader: quoted fields, "" escapes, commas or semicolons
 * (auto-detected from the header), CRLF/LF, a leading BOM and blank lines.
 * Returns rows of trimmed strings.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((f) => f !== "")) rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (ch === sep) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      endRow();
      if (ch === "\r" && src[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

/** Neutralize spreadsheet formulas when writing user data back out to CSV. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
