import { describeMovement, isChange, movement, movementTone } from "./compare";
import { AREA_LABEL, AREAS, CATEGORIES, CHART_KEYS, type Area, type ChartKey, formatCell, monthLabel } from "./model";
import type { StoredBulletin } from "./service";

/**
 * The bulletin ready to show: every value formatted in English and Spanish,
 * with how it moved since last month. Used by the app (via the API) and the
 * website, so both say exactly the same thing.
 */

/** `move` is null for the first month on record; `changed` is false for "No change". */
export type ViewCell = { value: { en: string; es: string }; move: { tone: "good" | "bad" | "neutral"; changed: boolean; en: string; es: string } | null };
export type ViewRow = { category: string; code: string; en: string; es: string; cells: Partial<Record<Area, ViewCell>> };
export type BulletinView = {
  month: string;
  label: { en: string; es: string };
  previousMonth: string | null;
  sourceUrl: string | null;
  importedAt: string;
  rows: Partial<Record<ChartKey, ViewRow[]>>;
};

export function bulletinView(current: StoredBulletin, previous: StoredBulletin | null): BulletinView {
  const rows: Partial<Record<ChartKey, ViewRow[]>> = {};
  for (const key of CHART_KEYS) {
    const chart = current.charts[key];
    if (!chart) continue;
    rows[key] = CATEGORIES.filter((c) => chart[c.key]).map((c) => {
      const cells: Partial<Record<Area, ViewCell>> = {};
      for (const area of AREAS) {
        const cell = chart[c.key]?.[area];
        if (!cell) continue;
        const m = previous ? movement(previous.charts[key]?.[c.key]?.[area], cell) : null;
        cells[area] = {
          value: { en: formatCell(cell, "en"), es: formatCell(cell, "es") },
          move: m && m.kind !== "new" ? { tone: movementTone(m), changed: isChange(m), en: describeMovement(m, "en"), es: describeMovement(m, "es") } : null,
        };
      }
      return { category: c.key, code: c.code, en: c.en, es: c.es, cells };
    });
  }
  return {
    month: current.month,
    label: { en: monthLabel(current.month, "en"), es: monthLabel(current.month, "es") },
    previousMonth: previous?.month ?? null,
    sourceUrl: current.sourceUrl,
    importedAt: current.importedAt.toISOString(),
    rows,
  };
}

export const CATALOG = {
  areas: AREAS.map((a) => ({ key: a, ...AREA_LABEL[a] })),
  categories: CATEGORIES,
};

/** USCIS's monthly page saying which chart applies for adjustment of status. */
export const USCIS_CHARTS_URL = "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";
export const STATE_BULLETIN_URL = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html";
