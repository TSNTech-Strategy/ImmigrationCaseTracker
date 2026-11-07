/** A-Numbers, hearing dates and reminder times for court cases (plain TypeScript, no phone APIs, so it's tested in Node). */

/** "A-123-456-789". */
export const formatANumber = (digits: string) => `A-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
/** "A-•••-•••-789": the last 3 digits only. */
export const maskANumber = (digits: string) => `A-•••-•••-${digits.slice(6, 9)}`;
export const validANumber = (digits: string) => /^\d{9}$/.test(digits);

/** "12/03/2026" → "2026-12-03", or null when it isn't a real date. */
export function parseUsDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [mm, dd, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
/** "9:30" + "PM" → "21:30", or null. */
export function parseTime(text: string, half: "AM" | "PM"): string | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h < 1 || h > 12 || min > 59) return null;
  const h24 = (h % 12) + (half === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
/** Types the slashes for "MMDDYYYY" as the person types. */
export function autoSlash(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
/** "YYYY-MM-DDTHH:MM" as a local Date. */
export const hearingDate = (at: string) => {
  const [d, t] = at.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = (t ?? "09:00").split(":").map(Number);
  return new Date(y, mo - 1, da, h, mi);
};
/** Whole days from today to the hearing day (0 = today, negative = past). */
export function daysUntil(at: string, now: Date = new Date()): number {
  const h = hearingDate(at);
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Reminders: a week before and the day before (9 AM), and 2 hours before the hearing. Only the ones still ahead. */
export function reminderTimes(at: string, now: Date = new Date()): { when: Date; kind: "week" | "day" | "soon" }[] {
  const h = hearingDate(at);
  const at9 = (daysBefore: number) => new Date(h.getFullYear(), h.getMonth(), h.getDate() - daysBefore, 9, 0);
  return [
    { when: at9(7), kind: "week" as const },
    { when: at9(1), kind: "day" as const },
    { when: new Date(h.getTime() - 2 * 3_600_000), kind: "soon" as const },
  ].filter((r) => r.when.getTime() > now.getTime());
}

