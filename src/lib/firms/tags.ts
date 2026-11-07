import type { FirmRole, PrismaClient } from "@prisma/client";
import { flatTags, isTagColor, normalizeTagName, tagKey, TAG_COLORS, type TagColor, type TagResult, type TagView, type TagWithCount } from "@/lib/cases/tags";
import { findFirmContext, type FirmContext } from "./service";

/**
 * Tags a firm's team shares on the firm's cases (CasePingo Pro): by attorney,
 * matter type, deadline or anything the firm works by.
 *
 * Rules
 * - Scoped to the caller's own firm, read fresh from the database. Another
 *   firm's tag or case looks exactly like a missing one, and the database's
 *   foreign keys also require the tag and the case to be the same firm's.
 * - Any member can create tags and put them on cases or take them off.
 *   Renaming, recoloring and deleting (which affect everyone): Owner or Admin.
 * - Every change is audit-logged with the tag names, so the activity log reads
 *   well even after a tag is renamed or deleted.
 */

export const FIRM_TAG_LIMITS = { perFirm: 50, perCase: 10, name: 32 } as const;

/** Firm case rows: the tags, A to Z. */
export const firmCaseTagsSelect = {
  firmTags: { select: { tag: { select: { id: true, name: true, color: true } } }, orderBy: { tag: { nameKey: "asc" } } },
} as const;

const fail = (error: "invalid" | "duplicate" | "limit" | "not_found" | "forbidden", message: string) => ({ ok: false as const, error, message });
const isUnique = (err: unknown) => (err as { code?: string }).code === "P2002";
const isManager = (role: FirmRole) => role === "OWNER" || role === "ADMIN";
const asColor = (v: string): TagColor => (isTagColor(v) ? v : "blue");
const NAME_RULE = `Use a name of 1 to ${FIRM_TAG_LIMITS.name} characters.`;
const NO_FIRM = "You're not part of a firm workspace.";
const MANAGERS_ONLY = "Only an Owner or Admin can rename, recolor or delete tags.";

/** The least-used color, so a new tag looks different from the others. */
export function nextTagColor(used: { color: string }[]): TagColor {
  const count = (c: TagColor) => used.filter((u) => u.color === c).length;
  return [...TAG_COLORS].sort((a, b) => count(a) - count(b))[0];
}

export function createFirmTagService({ db }: { db: PrismaClient }) {
  const ctxOf = (userId: string) => findFirmContext(db, userId);

  async function audit(ctx: FirmContext, action: string, targetType: string, targetId: string, metadata: object) {
    await db.auditLog.create({ data: { firmId: ctx.firm.id, actorUserId: ctx.membership.userId, action, targetType, targetId, metadata } });
  }

  /** The firm's tags (A to Z) with how many cases each is on, and whether the caller may manage them. */
  async function list(userId: string): Promise<{ ctx: FirmContext; canManage: boolean; tags: TagWithCount[] } | null> {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const rows = await db.firmTag.findMany({
      where: { firmId: ctx.firm.id },
      select: { id: true, name: true, color: true, _count: { select: { cases: true } } },
      orderBy: { nameKey: "asc" },
    });
    return { ctx, canManage: isManager(ctx.membership.role), tags: rows.map((r) => ({ id: r.id, name: r.name, color: asColor(r.color), caseCount: r._count.cases })) };
  }

  async function create(userId: string, input: { name?: unknown; color?: unknown }): Promise<TagResult<TagView>> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("not_found", NO_FIRM);
    const name = normalizeTagName(input.name, FIRM_TAG_LIMITS.name);
    if (!name) return fail("invalid", NAME_RULE);
    if (input.color != null && input.color !== "" && !isTagColor(input.color)) return fail("invalid", "Choose one of the colors.");
    const existing = await db.firmTag.findMany({ where: { firmId: ctx.firm.id }, select: { color: true } });
    if (existing.length >= FIRM_TAG_LIMITS.perFirm) return fail("limit", `Your firm can have up to ${FIRM_TAG_LIMITS.perFirm} tags. Delete one to add another.`);
    const color = isTagColor(input.color) ? input.color : nextTagColor(existing);
    try {
      const tag = await db.firmTag.create({ data: { firmId: ctx.firm.id, name, nameKey: tagKey(name), color }, select: { id: true, name: true } });
      await audit(ctx, "tag.created", "FirmTag", tag.id, { name, color });
      return { ok: true, value: { ...tag, color } };
    } catch (err) {
      if (isUnique(err)) return fail("duplicate", `Your firm already has a tag called "${name}".`);
      throw err;
    }
  }

  /** Rename and/or recolor (Owner or Admin). */
  async function update(userId: string, tagId: string, input: { name?: unknown; color?: unknown }): Promise<TagResult<TagView>> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("not_found", NO_FIRM);
    if (!isManager(ctx.membership.role)) return fail("forbidden", MANAGERS_ONLY);
    const before = await db.firmTag.findFirst({ where: { id: tagId, firmId: ctx.firm.id }, select: { id: true, name: true, color: true } });
    if (!before) return fail("not_found", "Tag not found.");
    const data: { name?: string; nameKey?: string; color?: TagColor } = {};
    if (input.name !== undefined) {
      const name = normalizeTagName(input.name, FIRM_TAG_LIMITS.name);
      if (!name) return fail("invalid", NAME_RULE);
      data.name = name;
      data.nameKey = tagKey(name);
    }
    if (input.color !== undefined) {
      if (!isTagColor(input.color)) return fail("invalid", "Choose one of the colors.");
      data.color = input.color;
    }
    try {
      const tag = await db.firmTag.update({ where: { id: before.id }, data, select: { id: true, name: true, color: true } });
      if (tag.name !== before.name || tag.color !== before.color) {
        await audit(ctx, "tag.updated", "FirmTag", tag.id, { from: before.name, to: tag.name, fromColor: before.color, color: tag.color });
      }
      return { ok: true, value: { ...tag, color: asColor(tag.color) } };
    } catch (err) {
      if (isUnique(err)) return fail("duplicate", `Your firm already has a tag called "${data.name}".`);
      throw err;
    }
  }

  /** Delete a tag (Owner or Admin): it comes off every case; the cases stay. */
  async function remove(userId: string, tagId: string): Promise<TagResult<null>> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("not_found", NO_FIRM);
    if (!isManager(ctx.membership.role)) return fail("forbidden", MANAGERS_ONLY);
    const tag = await db.firmTag.findFirst({ where: { id: tagId, firmId: ctx.firm.id }, select: { id: true, name: true, _count: { select: { cases: true } } } });
    if (!tag) return fail("not_found", "Tag not found.");
    await db.firmTag.delete({ where: { id: tag.id } });
    await audit(ctx, "tag.deleted", "FirmTag", tag.id, { name: tag.name, cases: tag._count.cases });
    return { ok: true, value: null };
  }

  /** Put exactly these tags on one of the firm's cases (any member). */
  async function setCaseTags(userId: string, caseId: string, tagIds: unknown): Promise<TagResult<TagView[]>> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("not_found", NO_FIRM);
    if (!Array.isArray(tagIds) || !tagIds.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64)) {
      return fail("invalid", "Send the list of tag ids.");
    }
    const ids = [...new Set(tagIds as string[])];
    if (ids.length > FIRM_TAG_LIMITS.perCase) return fail("limit", `A case can have up to ${FIRM_TAG_LIMITS.perCase} tags.`);
    const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true, ...firmCaseTagsSelect } });
    if (!c) return fail("not_found", "Case not found.");
    const chosen = ids.length ? await db.firmTag.findMany({ where: { id: { in: ids }, firmId: ctx.firm.id }, select: { id: true, name: true } }) : [];
    if (chosen.length !== ids.length) return fail("not_found", "Tag not found.");
    const before = new Map(c.firmTags.map(({ tag }) => [tag.id, tag.name]));
    const added = chosen.filter((t) => !before.has(t.id)).map((t) => t.name);
    const removed = [...before].filter(([id]) => !ids.includes(id)).map(([, name]) => name);
    await db.$transaction([
      db.firmCaseTag.deleteMany({ where: { caseId: c.id, firmId: ctx.firm.id, tagId: { notIn: ids } } }),
      db.firmCaseTag.createMany({ data: ids.map((tagId) => ({ caseId: c.id, tagId, firmId: ctx.firm.id })), skipDuplicates: true }),
    ]);
    if (added.length || removed.length) await audit(ctx, "case.tags_changed", "TrackedCase", c.id, { added, removed });
    const rows = await db.firmCaseTag.findMany({
      where: { caseId: c.id, firmId: ctx.firm.id },
      select: { tag: { select: { id: true, name: true, color: true } } },
      orderBy: { tag: { nameKey: "asc" } },
    });
    return { ok: true, value: flatTags(rows) };
  }

  return { list, create, update, remove, setCaseTags };
}

export type FirmTagService = ReturnType<typeof createFirmTagService>;
