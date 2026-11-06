import type { Plan, PrismaClient } from "@prisma/client";
import { PLAN_LIMITS } from "@/lib/plans";

/**
 * Daily question limits. One row per person per UTC day with a count, nothing
 * else. A question is reserved before the AI call (so parallel requests can't
 * pass the limit) and given back if the call fails before answering.
 */

type Db = Pick<PrismaClient, "$queryRaw" | "assistantUsage" | "user" | "firmMembership">;

const DAY_MS = 24 * 60 * 60 * 1000;
export const KEEP_DAYS = 30;
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** The person's plan and daily limit. Law firm members get Premium's limit. */
export async function assistantAllowance(db: Db, userId: string): Promise<{ plan: Plan; limit: number }> {
  const [user, membership] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    db.firmMembership.findFirst({ where: { userId, revokedAt: null }, select: { id: true } }),
  ]);
  const plan = user?.plan ?? "FREE";
  const limit = Math.max(PLAN_LIMITS[plan].assistantPerDay, membership ? PLAN_LIMITS.PREMIUM.assistantPerDay : 0);
  return { plan, limit };
}

export async function questionsUsed(db: Db, userId: string, now: Date): Promise<number> {
  const row = await db.assistantUsage.findUnique({ where: { userId_day: { userId, day: utcDay(now) } }, select: { count: true } });
  return row?.count ?? 0;
}

/** Count one question if the person is under the limit. Atomic: the database decides. */
export async function reserveQuestion(db: Db, userId: string, limit: number, now: Date): Promise<{ ok: boolean; used: number }> {
  const day = utcDay(now);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "AssistantUsage" ("userId", "day", "count", "updatedAt")
    VALUES (${userId}, ${day}, 1, ${now})
    ON CONFLICT ("userId", "day") DO UPDATE SET "count" = "AssistantUsage"."count" + 1, "updatedAt" = ${now}
    WHERE "AssistantUsage"."count" < ${limit}
    RETURNING "count"`;
  if (rows.length === 0) return { ok: false, used: limit };
  const used = Number(rows[0].count);
  // Once per person per day, clear everyone's counts older than KEEP_DAYS.
  if (used === 1) await db.assistantUsage.deleteMany({ where: { day: { lt: utcDay(new Date(now.getTime() - KEEP_DAYS * DAY_MS)) } } });
  return { ok: true, used };
}

/** Give a question back (the AI call failed before answering). */
export async function refundQuestion(db: Db, userId: string, now: Date): Promise<void> {
  await db.assistantUsage.updateMany({ where: { userId, day: utcDay(now), count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}
