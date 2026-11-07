import type { PrismaClient } from "@prisma/client";
import { checklistByKey, checklistItems } from "./checklists";

/**
 * Which checklist items a person has ticked. Stored per account (so the app and the website
 * agree), only as item keys: no documents are uploaded or kept.
 */
export function createChecklistService({ db }: { db: Pick<PrismaClient, "checklistCheck"> }) {
  /** The ticked item keys of one checklist (items the checklist no longer has are left out). */
  async function done(userId: string, key: string): Promise<string[]> {
    const c = checklistByKey(key);
    if (!c) return [];
    const valid = new Set(checklistItems(c).map((i) => i.key));
    const rows = await db.checklistCheck.findMany({ where: { userId, checklist: key }, select: { item: true }, orderBy: { checkedAt: "asc" } });
    return rows.map((r) => r.item).filter((k) => valid.has(k));
  }

  /** Tick or untick one item. */
  async function set(userId: string, key: string, item: string, value: boolean): Promise<{ ok: true; done: string[] } | { ok: false; error: "not_found" }> {
    const c = checklistByKey(key);
    if (!c || !checklistItems(c).some((i) => i.key === item)) return { ok: false, error: "not_found" };
    if (value) {
      await db.checklistCheck.upsert({ where: { userId_checklist_item: { userId, checklist: key, item } }, update: {}, create: { userId, checklist: key, item } });
    } else {
      await db.checklistCheck.deleteMany({ where: { userId, checklist: key, item } });
    }
    return { ok: true, done: await done(userId, key) };
  }

  /** Ticked items per checklist, for the list view. */
  async function all(userId: string): Promise<Map<string, Set<string>>> {
    const rows = await db.checklistCheck.findMany({ where: { userId }, select: { checklist: true, item: true } });
    const out = new Map<string, Set<string>>();
    for (const r of rows) {
      const c = checklistByKey(r.checklist);
      if (!c || !checklistItems(c).some((i) => i.key === r.item)) continue;
      out.set(r.checklist, (out.get(r.checklist) ?? new Set()).add(r.item));
    }
    return out;
  }

  return { done, set, all };
}
export type ChecklistService = ReturnType<typeof createChecklistService>;
