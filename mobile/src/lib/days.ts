/** "YYYY-MM-DD" from a USCIS date ("09-05-2023 14:28:46"), an ISO date or a timestamp; null if unknown. */
export function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{2})-(\d{2})-(\d{4})/.exec(value);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Whole days from one "YYYY-MM-DD" to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Today as "YYYY-MM-DD" (UTC, as the server counts). */
export const todayDay = () => new Date().toISOString().slice(0, 10);

/**
 * The span of the person's journey, counted like GET /api/v1/journey: from the earliest filing
 * to the latest end (the last update for a finished case, today for one still moving).
 */
export function journeySpan(cases: { days?: { filed: string | null; lastUpdate: string | null }; lineMap?: { finished: boolean } }[]): { days: number; cases: number } | null {
  const today = todayDay();
  const dated = cases.filter((x) => x.days?.filed);
  if (!dated.length) return null;
  const start = dated.map((x) => x.days!.filed!).sort()[0];
  const end = dated.map((x) => (x.lineMap?.finished ? (x.days!.lastUpdate ?? today) : today)).sort().at(-1)!;
  return { days: Math.max(0, daysBetween(start, end)), cases: dated.length };
}
