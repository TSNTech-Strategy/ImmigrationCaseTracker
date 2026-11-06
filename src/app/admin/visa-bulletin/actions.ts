"use server";

import { refresh } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { visaBulletinService } from "@/lib/visa-bulletin";
import { parseBulletin } from "@/lib/visa-bulletin/parse";
import { AREAS, CATEGORIES, type ChartKey, formatCell } from "@/lib/visa-bulletin/model";

export type ImportState = {
  error?: string;
  preview?: {
    month: string | null;
    rows: Partial<Record<ChartKey, number>>;
    warnings: string[];
    tables: { key: ChartKey; title: string; rows: { code: string; values: string[] }[] }[];
  };
  saved?: { month: string; sent: number; skipped: number; failed: number; newest: boolean };
};

const TITLES: Record<ChartKey, string> = {
  familyFinal: "Family: final action dates",
  familyFiling: "Family: dates for filing",
  employmentFinal: "Employment: final action dates",
  employmentFiling: "Employment: dates for filing",
};

/** Preview (check what was read) or save the pasted bulletin. Admins only. */
export async function bulletinImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not allowed." };
  const text = String(formData.get("text") ?? "");
  if (text.trim().length < 200) return { error: "Paste the whole bulletin page (its page source works best)." };
  if (text.length > 2_000_000) return { error: "That's too long to be one bulletin." };
  const parsed = parseBulletin(text);
  const override = String(formData.get("month") ?? "").trim();
  const month = override || parsed.month;

  if (formData.get("intent") === "save") {
    if (!month) return { error: "Enter the bulletin month (YYYY-MM)." };
    const r = await visaBulletinService().importBulletin({ month, charts: parsed.charts, sourceUrl: String(formData.get("sourceUrl") ?? ""), importedById: admin.id });
    if (!r.ok) return { error: r.error };
    refresh();
    return { saved: { month: r.month, newest: r.alerts !== null, ...(r.alerts ?? { sent: 0, skipped: 0, failed: 0 }) } };
  }

  const tables = (Object.keys(TITLES) as ChartKey[])
    .filter((k) => parsed.charts[k])
    .map((k) => ({
      key: k,
      title: TITLES[k],
      rows: CATEGORIES.filter((c) => parsed.charts[k]![c.key]).map((c) => ({ code: c.code, values: AREAS.map((a) => formatCell(parsed.charts[k]![c.key]?.[a])) })),
    }));
  return { preview: { month, rows: parsed.rows, warnings: parsed.warnings, tables } };
}
