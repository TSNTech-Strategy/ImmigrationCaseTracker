/**
 * The U.S. Department of State's monthly Visa Bulletin, as CasePingo stores it.
 *
 * Four charts: final action dates and dates for filing, for family-sponsored
 * and employment-based preferences. Each chart has a value per category and
 * chargeability area: "C" (current), "U" (unavailable) or a cut-off date.
 */

export const AREAS = ["ALL", "CHINA", "INDIA", "MEXICO", "PHILIPPINES"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABEL: Record<Area, { en: string; es: string }> = {
  ALL: { en: "All other countries", es: "Todos los demás países" },
  CHINA: { en: "China (mainland-born)", es: "China (nacidos en el continente)" },
  INDIA: { en: "India", es: "India" },
  MEXICO: { en: "Mexico", es: "México" },
  PHILIPPINES: { en: "Philippines", es: "Filipinas" },
};

export type Kind = "family" | "employment";

export type CategoryInfo = { key: string; kind: Kind; code: string; en: string; es: string };

export const CATEGORIES: CategoryInfo[] = [
  { key: "F1", kind: "family", code: "F1", en: "Unmarried sons and daughters (21+) of U.S. citizens", es: "Hijos solteros (21+) de ciudadanos de EE. UU." },
  { key: "F2A", kind: "family", code: "F2A", en: "Spouses and children (under 21) of green card holders", es: "Cónyuges e hijos (menores de 21) de residentes permanentes" },
  { key: "F2B", kind: "family", code: "F2B", en: "Unmarried sons and daughters (21+) of green card holders", es: "Hijos solteros (21+) de residentes permanentes" },
  { key: "F3", kind: "family", code: "F3", en: "Married sons and daughters of U.S. citizens", es: "Hijos casados de ciudadanos de EE. UU." },
  { key: "F4", kind: "family", code: "F4", en: "Brothers and sisters of adult U.S. citizens", es: "Hermanos de ciudadanos adultos de EE. UU." },
  { key: "EB1", kind: "employment", code: "EB-1", en: "Priority workers", es: "Trabajadores prioritarios" },
  { key: "EB2", kind: "employment", code: "EB-2", en: "Advanced degrees or exceptional ability", es: "Títulos avanzados o habilidad excepcional" },
  { key: "EB3", kind: "employment", code: "EB-3", en: "Skilled workers and professionals", es: "Trabajadores calificados y profesionales" },
  { key: "EW", kind: "employment", code: "EB-3 OW", en: "Other workers", es: "Otros trabajadores" },
  { key: "EB4", kind: "employment", code: "EB-4", en: "Special immigrants", es: "Inmigrantes especiales" },
  { key: "RW", kind: "employment", code: "EB-4 RW", en: "Certain religious workers", es: "Ciertos trabajadores religiosos" },
  { key: "EB5U", kind: "employment", code: "EB-5", en: "Investors, unreserved", es: "Inversionistas, no reservado" },
  { key: "EB5R", kind: "employment", code: "EB-5 Rural", en: "Investors, rural set-aside (20%)", es: "Inversionistas, reserva rural (20%)" },
  { key: "EB5H", kind: "employment", code: "EB-5 HU", en: "Investors, high-unemployment set-aside (10%)", es: "Inversionistas, reserva de alto desempleo (10%)" },
  { key: "EB5I", kind: "employment", code: "EB-5 Infra", en: "Investors, infrastructure set-aside (2%)", es: "Inversionistas, reserva de infraestructura (2%)" },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryInfo = (key: string) => CATEGORIES.find((c) => c.key === key) ?? null;

/** One value in a chart. Dates are "YYYY-MM-DD". */
export type Cell = { t: "C" } | { t: "U" } | { t: "D"; date: string };

export type Chart = Record<string, Partial<Record<Area, Cell>>>;

export const CHART_KEYS = ["familyFinal", "familyFiling", "employmentFinal", "employmentFiling"] as const;
export type ChartKey = (typeof CHART_KEYS)[number];
export type Charts = Partial<Record<ChartKey, Chart>>;

/** Which of the two charts a person follows. */
export type ChartType = "final" | "filing";
export const chartKey = (kind: Kind, type: ChartType): ChartKey => `${kind}${type === "final" ? "Final" : "Filing"}` as ChartKey;

export function cellFor(charts: Charts | null | undefined, category: string, area: Area, type: ChartType): Cell | null {
  const info = categoryInfo(category);
  if (!info || !charts) return null;
  return charts[chartKey(info.kind, type)]?.[category]?.[area] ?? null;
}

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-12" → "December 2026" / "diciembre de 2026". */
export function monthLabel(month: string, lang: "en" | "es" = "en") {
  const [y, m] = month.split("-").map(Number);
  return lang === "es" ? `${MONTHS_ES[m - 1]} de ${y}` : `${MONTHS_EN[m - 1]} ${y}`;
}

export const MONTH_NAMES_EN = MONTHS_EN;

/** "C" → "Current", "U" → "Unavailable", a date → "Jan 1, 2024" (or Spanish). */
export function formatCell(cell: Cell | null | undefined, lang: "en" | "es" = "en") {
  if (!cell) return "—";
  if (cell.t === "C") return lang === "es" ? "Vigente" : "Current";
  if (cell.t === "U") return lang === "es" ? "No disponible" : "Unavailable";
  const [y, m, d] = cell.date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
