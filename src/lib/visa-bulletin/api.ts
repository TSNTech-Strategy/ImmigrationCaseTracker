import type { PrismaClient } from "@prisma/client";
import { PLAN_LIMITS } from "@/lib/plans";
import type { ApiResult } from "@/lib/mobile/handlers";
import { isValidWatch, type VisaBulletinService } from "./service";
import { bulletinView, CATALOG, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "./view";

/** /api/v1/visa-bulletin handlers. Reading is open to everyone; choosing a category needs sign-in. */
export function createBulletinApi({ db, svc }: { db: PrismaClient; svc: VisaBulletinService }) {
  async function get(userId: string | null): Promise<ApiResult> {
    const { current, previous } = await svc.latest();
    let watch = null;
    let alerts = false;
    if (userId) {
      watch = await svc.getWatch(userId);
      const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
      alerts = u ? PLAN_LIMITS[u.plan].alerts : false;
    }
    return {
      status: 200,
      body: {
        bulletin: current ? bulletinView(current, previous) : null,
        catalog: CATALOG,
        watch,
        alerts,
        links: { bulletin: current?.sourceUrl ?? STATE_BULLETIN_URL, uscisCharts: USCIS_CHARTS_URL },
      },
    };
  }

  async function setWatch(userId: string, input: unknown): Promise<ApiResult> {
    const w = (input ?? {}) as { category?: unknown; area?: unknown; chart?: unknown };
    if (!isValidWatch(w)) return { status: 400, body: { error: "invalid", message: "Choose a category, a country and a chart." } };
    return { status: 200, body: { watch: await svc.setWatch(userId, { category: w.category, area: w.area, chart: w.chart }) } };
  }

  async function removeWatch(userId: string): Promise<ApiResult> {
    await svc.removeWatch(userId);
    return { status: 200, body: { watch: null } };
  }

  return { get, setWatch, removeWatch };
}
