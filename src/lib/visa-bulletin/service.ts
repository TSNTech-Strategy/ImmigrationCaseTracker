import type { PrismaClient } from "@prisma/client";
import type { EmailDriver } from "@/lib/email";
import { visaBulletinEmail } from "@/lib/email/templates";
import type { PushDriver } from "@/lib/push";
import { PLAN_LIMITS } from "@/lib/plans";
import { describeMovement, isChange, movement } from "./compare";
import { AREA_LABEL, AREAS, CATEGORY_KEYS, type Area, type Charts, type ChartType, cellFor, categoryInfo, formatCell, monthLabel } from "./model";

export type StoredBulletin = { month: string; sourceUrl: string | null; importedAt: Date; charts: Charts };
export type Watch = { category: string; area: Area; chart: ChartType };
export type AlertResult = { sent: number; skipped: number; failed: number };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const toStored = (b: { month: string; sourceUrl: string | null; importedAt: Date; charts: unknown }): StoredBulletin => ({
  month: b.month,
  sourceUrl: b.sourceUrl,
  importedAt: b.importedAt,
  charts: (b.charts ?? {}) as Charts,
});

export function isValidWatch(w: { category?: unknown; area?: unknown; chart?: unknown }): w is Watch {
  return (
    typeof w.category === "string" &&
    CATEGORY_KEYS.includes(w.category) &&
    typeof w.area === "string" &&
    (AREAS as readonly string[]).includes(w.area) &&
    (w.chart === "final" || w.chart === "filing")
  );
}

/** True for https:// links on state.gov (where the bulletin is published). */
export function isStateDeptUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "travel.state.gov" || u.hostname.endsWith(".state.gov"));
  } catch {
    return false;
  }
}

export function createVisaBulletinService({
  db,
  mailer,
  pusher,
  siteUrl,
  now = () => new Date(),
}: {
  db: PrismaClient;
  mailer: EmailDriver;
  pusher?: PushDriver;
  siteUrl: string;
  now?: () => Date;
}) {
  /** The newest bulletin and the one before it (for "moved ahead 2 months"). */
  async function latest(): Promise<{ current: StoredBulletin | null; previous: StoredBulletin | null }> {
    const [current, previous] = await db.visaBulletin.findMany({ orderBy: { month: "desc" }, take: 2 });
    return { current: current ? toStored(current) : null, previous: previous ? toStored(previous) : null };
  }

  async function months(): Promise<{ month: string; importedAt: Date; sourceUrl: string | null }[]> {
    return db.visaBulletin.findMany({ orderBy: { month: "desc" }, select: { month: true, importedAt: true, sourceUrl: true }, take: 24 });
  }

  /** Save a month (replacing an earlier import of the same month); alert watchers if it's the newest. */
  async function importBulletin(input: { month: string; sourceUrl?: string | null; charts: Charts; importedById?: string | null }) {
    if (!MONTH.test(input.month)) return { ok: false as const, error: "Enter the month as YYYY-MM." };
    // The link is shown on the website and opened by the app, so only the State Department's own pages.
    if (input.sourceUrl?.trim() && !isStateDeptUrl(input.sourceUrl.trim())) return { ok: false as const, error: "The link must be an https:// address on travel.state.gov." };
    if (!input.charts.familyFinal || !input.charts.employmentFinal) return { ok: false as const, error: "The final action dates for family and employment are both needed." };
    const data = { charts: input.charts as object, sourceUrl: input.sourceUrl?.trim() || null, importedById: input.importedById ?? null, importedAt: now() };
    await db.visaBulletin.upsert({ where: { month: input.month }, create: { month: input.month, ...data }, update: data });
    const newest = await db.visaBulletin.findFirst({ orderBy: { month: "desc" }, select: { month: true } });
    const alerts = newest?.month === input.month ? await alertWatchers(input.month) : null;
    return { ok: true as const, month: input.month, alerts };
  }

  /**
   * Tell Premium people whose category moved in this month's bulletin (compared
   * with the month before), by email and push, once per month.
   */
  async function alertWatchers(month: string): Promise<AlertResult> {
    const result: AlertResult = { sent: 0, skipped: 0, failed: 0 };
    const cur = await db.visaBulletin.findUnique({ where: { month } });
    const prev = await db.visaBulletin.findFirst({ where: { month: { lt: month } }, orderBy: { month: "desc" } });
    if (!cur || !prev) return result;
    const curCharts = cur.charts as Charts;
    const prevCharts = prev.charts as Charts;
    const watches = await db.visaBulletinWatch.findMany({
      where: { OR: [{ lastNotifiedMonth: null }, { lastNotifiedMonth: { not: month } }] },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            locale: true,
            plan: true,
            notificationPreference: { select: { emailOnChange: true, pushOnChange: true } },
            pushDevices: { where: { disabledAt: null }, select: { id: true, token: true } },
          },
        },
      },
    });

    for (const w of watches) {
      const u = w.user;
      const info = categoryInfo(w.category);
      if (!info || !PLAN_LIMITS[u.plan].alerts) {
        result.skipped++;
        continue;
      }
      const area = w.area as Area;
      const lang = u.locale === "es" ? "es" : "en";
      const lines: string[] = [];
      for (const type of ["final", "filing"] as const) {
        const before = cellFor(prevCharts, w.category, area, type);
        const after = cellFor(curCharts, w.category, area, type);
        const m = movement(before, after);
        if (!isChange(m)) continue;
        const label = type === "final" ? (lang === "es" ? "Fecha de acción final" : "Final action date") : lang === "es" ? "Fecha para presentar" : "Date for filing";
        lines.push(`${label}: ${formatCell(after, lang)} (${describeMovement(m, lang).toLowerCase()})`);
      }
      if (lines.length === 0) {
        result.skipped++;
        continue;
      }
      const category = `${info.code} · ${info[lang]}`;
      // Each channel on its own: a failed push mustn't make a later re-save email the person again.
      let delivered = false;
      let failed = false;
      if (u.notificationPreference?.emailOnChange !== false) {
        try {
          await mailer.send(
            visaBulletinEmail({
              to: u.email,
              name: u.name,
              locale: lang,
              month: monthLabel(month, lang),
              category,
              area: AREA_LABEL[area][lang],
              lines,
              pageUrl: `${siteUrl}/visa-bulletin`,
              settingsUrl: `${siteUrl}/settings`,
            }),
          );
          delivered = true;
        } catch {
          failed = true;
        }
      }
      if (pusher && u.notificationPreference?.pushOnChange && u.pushDevices.length > 0) {
        try {
          const title = lang === "es" ? `Boletín de Visas: ${info.code} cambió` : `Visa Bulletin: ${info.code} moved`;
          const results = await pusher.send(u.pushDevices.map((d) => ({ to: d.token, title, body: lines[0], data: { screen: "bulletin" } })));
          const dead = u.pushDevices.filter((_, i) => results[i]?.status === "dead").map((d) => d.id);
          if (dead.length) await db.pushDevice.updateMany({ where: { id: { in: dead } }, data: { disabledAt: now() } });
          if (results.some((r) => r.status === "ok")) delivered = true;
          else if (results.some((r) => r.status !== "dead")) failed = true;
        } catch {
          failed = true;
        }
      }
      if (delivered) {
        await db.visaBulletinWatch.update({ where: { id: w.id }, data: { lastNotifiedMonth: month } });
        result.sent++;
      } else if (failed) result.failed++;
      else result.skipped++; // both alerts turned off, or only dead phones
    }
    return result;
  }

  async function getWatch(userId: string): Promise<Watch | null> {
    const w = await db.visaBulletinWatch.findUnique({ where: { userId } });
    return w && isValidWatch(w) ? { category: w.category, area: w.area as Area, chart: w.chart as ChartType } : null;
  }

  async function setWatch(userId: string, watch: Watch): Promise<Watch> {
    // A new choice starts fresh: the next bulletin can alert about it.
    await db.visaBulletinWatch.upsert({
      where: { userId },
      create: { userId, ...watch },
      update: { ...watch, lastNotifiedMonth: null },
    });
    return watch;
  }

  async function removeWatch(userId: string) {
    await db.visaBulletinWatch.deleteMany({ where: { userId } });
  }

  return { latest, months, importBulletin, alertWatchers, getWatch, setWatch, removeWatch };
}

export type VisaBulletinService = ReturnType<typeof createVisaBulletinService>;
