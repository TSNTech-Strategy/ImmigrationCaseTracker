import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Tags: labels people put on their own cases ("Family", "Work") to group and
 * filter them, on the website and in the app. Personal cases only for now.
 * Every query is scoped to the signed-in person, and the database's foreign
 * keys also require the tag and the case to have the same owner.
 */

/** The same small palette on the website and in the app. */
export const TAG_COLORS = ["blue", "green", "amber", "red", "purple", "gray"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export const TAG_LIMITS = { perPerson: 20, perCase: 10, name: 24 } as const;

export type TagView = { id: string; name: string; color: TagColor };
export type TagWithCount = TagView & { caseCount: number };
export type TagResult<T> = { ok: true; value: T } | { ok: false; error: "invalid" | "duplicate" | "limit" | "not_found"; message: string };

export const isTagColor = (v: unknown): v is TagColor => typeof v === "string" && (TAG_COLORS as readonly string[]).includes(v);
const asColor = (v: string): TagColor => (isTagColor(v) ? v : "blue");

/** Trimmed, single spaces; null when empty, too long, or with control characters. */
export function normalizeTagName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!name || name.length > TAG_LIMITS.name || /[\u0000-\u001f\u007f-\u009f]/.test(name)) return null;
  return name;
}
/** One tag per name per person, whatever the capitals. */
export const tagKey = (name: string) => name.toLowerCase();

/** Prisma select for a case's tags (A to Z), and the flat list the pages and the app use. */
export const caseTagsSelect = {
  tags: { select: { tag: { select: { id: true, name: true, color: true } } }, orderBy: { tag: { nameKey: "asc" } } },
} satisfies Prisma.TrackedCaseSelect;
export function flatTags(rows: { tag: { id: string; name: string; color: string } }[]): TagView[] {
  return rows.map(({ tag }) => ({ id: tag.id, name: tag.name, color: asColor(tag.color) }));
}

const fail = (error: "invalid" | "duplicate" | "limit" | "not_found", message: string) => ({ ok: false as const, error, message });
const isUnique = (err: unknown) => (err as { code?: string }).code === "P2002";
const NAME_RULE = `Use a name of 1 to ${TAG_LIMITS.name} characters.`;

export function createTagService({ db }: { db: PrismaClient }) {
  async function list(userId: string): Promise<TagWithCount[]> {
    const rows = await db.caseTag.findMany({
      where: { ownerUserId: userId },
      select: { id: true, name: true, color: true, _count: { select: { cases: true } } },
      orderBy: { nameKey: "asc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, color: asColor(r.color), caseCount: r._count.cases }));
  }

  /** The first color not used yet (or the least used one), so new tags look different. */
  async function nextColor(userId: string): Promise<TagColor> {
    const used = await db.caseTag.groupBy({ by: ["color"], where: { ownerUserId: userId }, _count: { _all: true } });
    const count = (c: TagColor) => used.find((u) => u.color === c)?._count._all ?? 0;
    return [...TAG_COLORS].sort((a, b) => count(a) - count(b))[0];
  }

  async function create(userId: string, input: { name?: unknown; color?: unknown }): Promise<TagResult<TagView>> {
    const name = normalizeTagName(input.name);
    if (!name) return fail("invalid", NAME_RULE);
    if (input.color != null && !isTagColor(input.color)) return fail("invalid", "Choose one of the colors.");
    if ((await db.caseTag.count({ where: { ownerUserId: userId } })) >= TAG_LIMITS.perPerson) {
      return fail("limit", `You can have up to ${TAG_LIMITS.perPerson} tags. Delete one to add another.`);
    }
    const color = isTagColor(input.color) ? input.color : await nextColor(userId);
    try {
      const tag = await db.caseTag.create({ data: { ownerUserId: userId, name, nameKey: tagKey(name), color }, select: { id: true, name: true } });
      return { ok: true, value: { ...tag, color } };
    } catch (err) {
      if (isUnique(err)) return fail("duplicate", `You already have a tag called "${name}".`);
      throw err;
    }
  }

  /** Rename and/or recolor one of the person's tags. */
  async function update(userId: string, tagId: string, input: { name?: unknown; color?: unknown }): Promise<TagResult<TagView>> {
    const data: { name?: string; nameKey?: string; color?: TagColor } = {};
    if (input.name !== undefined) {
      const name = normalizeTagName(input.name);
      if (!name) return fail("invalid", NAME_RULE);
      data.name = name;
      data.nameKey = tagKey(name);
    }
    if (input.color !== undefined) {
      if (!isTagColor(input.color)) return fail("invalid", "Choose one of the colors.");
      data.color = input.color;
    }
    try {
      const r = await db.caseTag.updateMany({ where: { id: tagId, ownerUserId: userId }, data });
      if (r.count !== 1) return fail("not_found", "Tag not found.");
    } catch (err) {
      if (isUnique(err)) return fail("duplicate", `You already have a tag called "${data.name}".`);
      throw err;
    }
    const tag = await db.caseTag.findUniqueOrThrow({ where: { id: tagId }, select: { id: true, name: true, color: true } });
    return { ok: true, value: { ...tag, color: asColor(tag.color) } };
  }

  /** Delete a tag; it comes off every case (the cases stay). */
  async function remove(userId: string, tagId: string): Promise<TagResult<null>> {
    const r = await db.caseTag.deleteMany({ where: { id: tagId, ownerUserId: userId } });
    return r.count === 1 ? { ok: true, value: null } : fail("not_found", "Tag not found.");
  }

  /** Replace the tags on one of the person's cases with exactly these. */
  async function setCaseTags(userId: string, caseId: string, tagIds: unknown): Promise<TagResult<TagView[]>> {
    if (!Array.isArray(tagIds) || !tagIds.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64)) {
      return fail("invalid", "Send the list of tag ids.");
    }
    const ids = [...new Set(tagIds as string[])];
    if (ids.length > TAG_LIMITS.perCase) return fail("limit", `A case can have up to ${TAG_LIMITS.perCase} tags.`);
    const owned = await db.trackedCase.findFirst({ where: { id: caseId, ownerUserId: userId }, select: { id: true } });
    if (!owned) return fail("not_found", "Case not found.");
    if (ids.length && (await db.caseTag.count({ where: { id: { in: ids }, ownerUserId: userId } })) !== ids.length) {
      return fail("not_found", "Tag not found.");
    }
    await db.$transaction([
      db.trackedCaseTag.deleteMany({ where: { caseId, ownerUserId: userId, tagId: { notIn: ids } } }),
      db.trackedCaseTag.createMany({ data: ids.map((tagId) => ({ caseId, tagId, ownerUserId: userId })), skipDuplicates: true }),
    ]);
    const rows = await db.trackedCaseTag.findMany({
      where: { caseId, ownerUserId: userId },
      select: { tag: { select: { id: true, name: true, color: true } } },
      orderBy: { tag: { nameKey: "asc" } },
    });
    return { ok: true, value: flatTags(rows) };
  }

  return { list, create, update, remove, setCaseTags };
}

export type TagService = ReturnType<typeof createTagService>;
