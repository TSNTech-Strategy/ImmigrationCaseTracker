import { describe, expect, it } from "vitest";
import { bulletinEssentials, parseBulletin, parseCell } from "../parse";
import { cellFor, formatCell, monthLabel } from "../model";
import { describeMovement, isChange, movement, movementTone } from "../compare";
import { bulletinView } from "../view";

// Test pages in the bulletin's published layout (values are test values, not a real month).
const famRows = (v: string) =>
  ["F1", "F2A", "F2B", "F3", "F4"].map((k, i) => `<tr><td>${k}</td><td>${v}</td><td>0${i + 1}JAN15</td><td>C</td><td>U</td><td>15MAR98</td></tr>`).join("");
const EB_LABELS = [
  "1st",
  "2nd",
  "3rd",
  "Other Workers",
  "4th",
  "Certain Religious Workers",
  "5th Unreserved<br>(including C5, T5, I5, R5)",
  "5th Set Aside:<br>Rural (20%)",
  "5th Set Aside:<br>High Unemployment (10%)",
  "5th Set Aside:<br>Infrastructure (2%)",
];
const ebRows = (v: string) => EB_LABELS.map((l) => `<tr><td>${l}</td><td>${v}</td><td>01FEB21</td><td>01JUL13</td><td>C</td><td>U</td></tr>`).join("");
const header = (first: string) =>
  `<tr><td>${first}</td><td>All Charge-<br>ability Areas Except Those Listed</td><td>CHINA-mainland born</td><td>INDIA</td><td>MEXICO</td><td>PHILIPPINES</td></tr>`;
const HTML = `<html><body><h1>Visa Bulletin For December 2026</h1>
<p>A. FINAL ACTION DATES FOR FAMILY-SPONSORED PREFERENCE CASES</p><table>${header("Family-<br>Sponsored")}${famRows("08NOV16")}</table>
<p>B. DATES FOR FILING FAMILY-SPONSORED VISA APPLICATIONS</p><table>${header("Family-<br>Sponsored")}${famRows("01SEP17")}</table>
<table><tr><td>Region</td><td>Rank cut-off</td></tr><tr><td>AFRICA</td><td>45,000</td></tr></table>
<p>A. FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES</p><table>${header("Employment-<br>based")}${ebRows("C")}</table>
<p>B. DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS</p><table>${header("Employment-<br>based")}${ebRows("01JAN25")}</table>
</body></html>`;

describe("parseCell", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("reads current, unavailable and dates", () => {
    expect(parseCell("C", now)).toEqual({ t: "C" });
    expect(parseCell(" u ", now)).toEqual({ t: "U" });
    expect(parseCell("01JAN15", now)).toEqual({ t: "D", date: "2015-01-01" });
    expect(parseCell("15MAR98", now)).toEqual({ t: "D", date: "1998-03-15" });
    expect(parseCell("31FEB20", now)).toBeNull();
    expect(parseCell("soon", now)).toBeNull();
  });
});

describe("parseBulletin", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("reads the four charts and the month from the page source", () => {
    const r = parseBulletin(HTML, now);
    expect(r.month).toBe("2026-12");
    expect(r.rows).toEqual({ familyFinal: 5, familyFiling: 5, employmentFinal: 10, employmentFiling: 10 });
    expect(cellFor(r.charts, "F2A", "ALL", "final")).toEqual({ t: "D", date: "2016-11-08" });
    expect(cellFor(r.charts, "F2A", "ALL", "filing")).toEqual({ t: "D", date: "2017-09-01" });
    expect(cellFor(r.charts, "F4", "PHILIPPINES", "final")).toEqual({ t: "D", date: "1998-03-15" });
    expect(cellFor(r.charts, "F1", "MEXICO", "final")).toEqual({ t: "U" });
    expect(cellFor(r.charts, "EB5U", "ALL", "final")).toEqual({ t: "C" });
    expect(cellFor(r.charts, "EB5I", "INDIA", "filing")).toEqual({ t: "D", date: "2013-07-01" });
    expect(cellFor(r.charts, "EW", "CHINA", "final")).toEqual({ t: "D", date: "2021-02-01" });
    // A complete page: nothing to warn about.
    expect(r.warnings).toEqual([]);
  });

  it("warns when a category is missing", () => {
    const r = parseBulletin(HTML.replace(/<tr><td>Certain Religious Workers<\/td>.*?<\/tr>/g, ""), now);
    expect(r.rows.employmentFinal).toBe(9);
    expect(r.warnings).toContain("Employment final action dates: found 9 of 10 categories.");
  });

  it("maps columns by their headings, not their position", () => {
    const swapped = HTML.replace(/<td>CHINA-mainland born<\/td><td>INDIA<\/td>/, "<td>INDIA</td><td>CHINA-mainland born</td>");
    const r = parseBulletin(swapped, now);
    // In the first family table the India column now comes first, so "02JAN15"-style values land under INDIA.
    expect(cellFor(r.charts, "F2A", "INDIA", "final")).toEqual({ t: "D", date: "2015-01-02" });
    expect(cellFor(r.charts, "F2A", "CHINA", "final")).toEqual({ t: "C" });
  });

  it("reads text copied from a browser, including a label that wrapped onto its own line", () => {
    const text = [
      "Visa Bulletin For January 2027",
      "Family-Sponsored\tAll Chargeability Areas Except Those Listed\tCHINA-mainland born\tINDIA\tMEXICO\tPHILIPPINES",
      "F1\t08NOV16\t08NOV16\t08NOV16\t01APR05\t01MAR12",
      "F2A\t01FEB24\t01FEB24\t01FEB24\t01FEB21\t01FEB24",
      "F2B\t22SEP16\t22SEP16\t22SEP16\t15JUN09\t22OCT12",
      "F3\t01JAN12\t01JAN12\t01JAN12\t01MAY01\t08FEB05",
      "F4\t08JAN08\t08JAN08\t15MAR06\t22APR01\t01JUL05",
      "Employment-based\tAll Chargeability Areas Except Those Listed\tCHINA-mainland born\tINDIA\tMEXICO\tPHILIPPINES",
      "1st\tC\t01NOV22\t15FEB22\tC\tC",
      "5th Unreserved",
      "(including C5, T5, I5, R5)\tC\t22JAN14\t01MAY22\tC\tC",
      "5th Set Aside: Rural (20%)\tC\tC\tC\tC\tC",
    ].join("\n");
    const r = parseBulletin(text, now);
    expect(r.month).toBe("2027-01");
    expect(cellFor(r.charts, "F2A", "MEXICO", "final")).toEqual({ t: "D", date: "2021-02-01" });
    expect(cellFor(r.charts, "EB5U", "CHINA", "final")).toEqual({ t: "D", date: "2014-01-22" });
    expect(cellFor(r.charts, "EB5R", "INDIA", "final")).toEqual({ t: "C" });
    expect(r.charts.familyFiling).toBeUndefined();
    expect(r.warnings.some((w) => w.startsWith("Family dates for filing: table not found"))).toBe(true);
  });

  it("keeps only the tables and the title of a big page source, and reads it the same", () => {
    const menu = `<nav>${"<ul><li><a href='/x'>Menu item</a></li></ul>".repeat(20000)}</nav>`;
    const page = HTML.replace("<body>", `<body>${menu}<script>var x = "${"y".repeat(300000)}";</script>`);
    const small = bulletinEssentials(page);
    expect(page.length).toBeGreaterThan(1_000_000);
    expect(small.length).toBeLessThan(20_000);
    expect(small.startsWith("<h1>Visa Bulletin For December 2026</h1>")).toBe(true);
    expect(parseBulletin(small, now)).toEqual(parseBulletin(page, now));
    // Copied page text has no tables: sent as it is.
    expect(bulletinEssentials("Visa Bulletin For January 2027\nF1\t08NOV16")).toBe("Visa Bulletin For January 2027\nF1\t08NOV16");
  });

  it("asks for the month when the page doesn't say", () => {
    const r = parseBulletin("nothing useful here", now);
    expect(r.month).toBeNull();
    expect(r.warnings).toContain("Couldn't find the bulletin month; enter it below.");
  });
});

describe("movement", () => {
  const d = (date: string) => ({ t: "D" as const, date });
  it("describes how a date moved", () => {
    expect(describeMovement(movement(d("2023-01-01"), d("2023-04-01")))).toBe("Moved ahead 3 months");
    expect(describeMovement(movement(d("2023-04-01"), d("2022-01-01")), "es")).toBe("Retrocedió 1 año y 3 meses");
    expect(describeMovement(movement(d("2023-01-01"), d("2023-01-15")))).toBe("Moved ahead 2 weeks");
    expect(describeMovement(movement(d("2023-01-01"), { t: "C" }))).toBe("Now current");
    expect(describeMovement(movement({ t: "C" }, d("2020-01-01")))).toBe("No longer current");
    expect(describeMovement(movement({ t: "U" }, d("2020-01-01")))).toBe("Available again");
    expect(describeMovement(movement(d("2020-01-01"), { t: "U" }))).toBe("Unavailable this month");
    expect(movement(d("2020-01-01"), d("2020-01-01"))).toEqual({ kind: "same" });
    expect(movement(null, d("2020-01-01"))).toEqual({ kind: "new" });
  });
  it("knows what's worth an alert and how to colour it", () => {
    expect(isChange(movement({ t: "C" }, { t: "C" }))).toBe(false);
    expect(isChange(movement(null, { t: "C" }))).toBe(false);
    expect(isChange(movement({ t: "D", date: "2020-01-01" }, { t: "D", date: "2020-02-01" }))).toBe(true);
    expect(movementTone({ kind: "ahead", days: 30 })).toBe("good");
    expect(movementTone({ kind: "back", days: 30 })).toBe("bad");
    expect(movementTone({ kind: "same" })).toBe("neutral");
  });
});

describe("labels", () => {
  it("formats months and values", () => {
    expect(monthLabel("2026-12")).toBe("December 2026");
    expect(monthLabel("2026-12", "es")).toBe("diciembre de 2026");
    expect(formatCell({ t: "D", date: "2024-01-01" })).toBe("Jan 1, 2024");
    expect(formatCell({ t: "C" }, "es")).toBe("Vigente");
    expect(formatCell(null)).toBe("—");
  });
});

describe("bulletinView", () => {
  const at = new Date("2026-12-01T00:00:00Z");
  const nov = { month: "2026-11", sourceUrl: null, importedAt: at, charts: { familyFinal: { F2A: { ALL: { t: "D" as const, date: "2022-01-01" }, MEXICO: { t: "D" as const, date: "2021-02-01" } } } } };
  const dec = { month: "2026-12", sourceUrl: null, importedAt: at, charts: { familyFinal: { F2A: { ALL: { t: "D" as const, date: "2022-01-01" }, MEXICO: { t: "D" as const, date: "2021-05-01" } } } } };
  it("formats values and says which ones changed", () => {
    const v = bulletinView(dec, nov);
    const cells = v.rows.familyFinal![0].cells;
    expect(v.label).toEqual({ en: "December 2026", es: "diciembre de 2026" });
    expect(cells.MEXICO).toEqual({ value: { en: "May 1, 2021", es: expect.any(String) }, move: { tone: "good", changed: true, en: "Moved ahead 3 months", es: "Avanzó 3 meses" } });
    expect(cells.ALL?.move).toMatchObject({ tone: "neutral", changed: false, en: "No change" });
  });
  it("has no movement for the first month on record", () => {
    expect(bulletinView(dec, null).rows.familyFinal![0].cells.MEXICO?.move).toBeNull();
  });
});
