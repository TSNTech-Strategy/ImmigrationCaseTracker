import { AREAS, type Area, CATEGORIES, type Cell, type Chart, type ChartKey, type Charts, type Kind, MONTH_NAMES_EN } from "./model";

/**
 * Reads the Visa Bulletin as an admin pastes it: either the page source (HTML,
 * most reliable) or the visible page text copied from a browser (table cells
 * separated by tabs). Finds the family and employment tables in page order:
 * the first of each kind is "final action dates", the second "dates for filing".
 */

export type ParseResult = {
  month: string | null;
  charts: Charts;
  /** Recognised rows per chart, e.g. { familyFinal: 5 }. */
  rows: Partial<Record<ChartKey, number>>;
  warnings: string[];
};

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** "C" → current, "U" → unavailable, "01JAN15" → 2015-01-01 (two-digit years past next year mean the 1900s). */
export function parseCell(raw: string, now: Date = new Date()): Cell | null {
  const v = raw.replace(/\s+/g, "").toUpperCase();
  if (v === "C") return { t: "C" };
  if (v === "U") return { t: "U" };
  const m = /^(\d{1,2})([A-Z]{3})(\d{2}|\d{4})$/.exec(v);
  if (!m || !MONTHS[m[2]]) return null;
  let year = Number(m[3]);
  if (m[3].length === 2) year += year > (now.getUTCFullYear() % 100) + 1 ? 1900 : 2000;
  const month = MONTHS[m[2]];
  const day = Number(m[1]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { t: "D", date: `${year}-${pad(month)}-${pad(day)}` };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

const ROW_RULES: [RegExp, string, Kind][] = [
  [/^f1$/, "F1", "family"],
  [/^f2a$/, "F2A", "family"],
  [/^f2b$/, "F2B", "family"],
  [/^f3$/, "F3", "family"],
  [/^f4$/, "F4", "family"],
  [/^1st\b/, "EB1", "employment"],
  [/^2nd\b/, "EB2", "employment"],
  [/^3rd\b/, "EB3", "employment"],
  [/^other workers\b/, "EW", "employment"],
  [/^4th\b/, "EB4", "employment"],
  [/^certain religious workers\b/, "RW", "employment"],
  [/^5th unreserved\b/, "EB5U", "employment"],
  [/\brural\b/, "EB5R", "employment"],
  [/\bhigh unemployment\b/, "EB5H", "employment"],
  [/\binfrastructure\b/, "EB5I", "employment"],
];

function matchCategory(label: string, kind: Kind): string | null {
  const n = norm(label);
  for (const [re, key, k] of ROW_RULES) if (k === kind && re.test(n)) return key;
  return null;
}

function areaOf(header: string): Area | null {
  const n = norm(header);
  if (n.startsWith("all charge")) return "ALL";
  if (n.includes("china")) return "CHINA";
  if (n.includes("india")) return "INDIA";
  if (n.includes("mexico")) return "MEXICO";
  if (n.includes("philippines")) return "PHILIPPINES";
  return null;
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8209;|&#8211;|&ndash;|&#45;/gi, "-")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const BREAK = Symbol("table break");
type Row = string[] | typeof BREAK;

function rowsFromHtml(html: string): Row[] {
  const out: Row[] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    out.push(BREAK);
    for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      out.push([...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => decode(m[1])));
    }
  }
  return out;
}

function rowsFromText(text: string): Row[] {
  return text.split(/\r?\n/).map((line) => (line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)).map((c) => c.trim()));
}

type Table = { kind: Kind; chart: Chart; count: number };

export function parseBulletin(input: string, now: Date = new Date()): ParseResult {
  const isHtml = /<table[\s>]/i.test(input);
  const rows = isHtml ? rowsFromHtml(input) : rowsFromText(input);
  const tables: Table[] = [];
  let current: (Table & { areas: Area[] }) | null = null;
  let pendingKey: string | null = null;
  let badCells = 0;

  const flush = () => {
    if (current && current.count >= 3) tables.push({ kind: current.kind, chart: current.chart, count: current.count });
    current = null;
    pendingKey = null;
  };

  for (const row of rows) {
    if (row === BREAK) {
      flush();
      continue;
    }
    const cells = row.filter((c, i) => i === 0 || c !== "");
    const first = norm(cells[0] ?? "");
    if (/^family\b/.test(first) || /^employment\b/.test(first)) {
      flush();
      const found = cells.slice(1).map(areaOf);
      const areas = found.filter((a): a is Area => a !== null);
      current = { kind: first.startsWith("family") ? "family" : "employment", chart: {}, count: 0, areas: areas.length === AREAS.length ? areas : [...AREAS] };
      continue;
    }
    if (!current) continue;
    const table: Table & { areas: Area[] } = current;
    let key = matchCategory(cells[0] ?? "", table.kind);
    let values = cells.slice(1);
    // A label that wrapped onto its own line (copied text): the values come on the next line.
    if (key && values.length === 0) {
      pendingKey = key;
      continue;
    }
    if (!key && pendingKey && values.length >= table.areas.length) {
      key = pendingKey;
    }
    pendingKey = null;
    if (!key) continue;
    values = values.slice(0, table.areas.length);
    if (values.length < table.areas.length) continue;
    const entry: Partial<Record<Area, Cell>> = {};
    values.forEach((v, i) => {
      const cell = parseCell(v, now);
      if (cell) entry[table.areas[i]] = cell;
      else badCells++;
    });
    if (!table.chart[key]) table.count++;
    table.chart[key] = entry;
  }
  flush();

  const charts: Charts = {};
  const counts: Partial<Record<ChartKey, number>> = {};
  for (const kind of ["family", "employment"] as const) {
    const ofKind = tables.filter((t) => t.kind === kind);
    const keys: ChartKey[] = kind === "family" ? ["familyFinal", "familyFiling"] : ["employmentFinal", "employmentFiling"];
    ofKind.slice(0, 2).forEach((t, i) => {
      charts[keys[i]] = t.chart;
      counts[keys[i]] = t.count;
    });
  }

  const warnings: string[] = [];
  const inKind = (kind: Kind) => CATEGORIES.filter((c) => c.kind === kind).length;
  const expected: Record<ChartKey, number> = { familyFinal: inKind("family"), familyFiling: inKind("family"), employmentFinal: inKind("employment"), employmentFiling: inKind("employment") };
  const names: Record<ChartKey, string> = {
    familyFinal: "Family final action dates",
    familyFiling: "Family dates for filing",
    employmentFinal: "Employment final action dates",
    employmentFiling: "Employment dates for filing",
  };
  for (const k of Object.keys(expected) as ChartKey[]) {
    if (!counts[k]) warnings.push(`${names[k]}: table not found.`);
    else if (counts[k]! < expected[k]) warnings.push(`${names[k]}: found ${counts[k]} of ${expected[k]} categories.`);
  }
  if (badCells) warnings.push(`${badCells} value${badCells === 1 ? "" : "s"} couldn't be read and were left out.`);

  const plain = isHtml ? decode(input) : input;
  const m = new RegExp(`visa bulletin for (${MONTH_NAMES_EN.join("|")})\\s+(\\d{4})`, "i").exec(plain);
  const month = m ? `${m[2]}-${pad(MONTH_NAMES_EN.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) + 1)}` : null;
  if (!month) warnings.push("Couldn't find the bulletin month; enter it below.");

  return { month, charts, rows: counts, warnings };
}
