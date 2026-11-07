import type { MatterKind, PrismaClient } from "@prisma/client";
import { findFirmContext } from "./service";
import { ACTIVE } from "./tasks";

/**
 * Matters group a firm's related cases: a family's petitions, an employer's workers, a lawsuit, or anything
 * the firm names. A case belongs to at most one matter; tasks can be linked to one too.
 * Any member can create matters and move cases in or out; archiving is for Owners and Admins.
 */

export const MATTER_KINDS: Record<MatterKind, { label: string; hint: string }> = {
  FAMILY: { label: "Family", hint: "Petitions and applications for one family" },
  EMPLOYER: { label: "Employer", hint: "An employer's petitions for its workers" },
  LAWSUIT: { label: "Lawsuit", hint: "Mandamus or other litigation" },
  CUSTOM: { label: "Other", hint: "Any other group" },
};

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export type MatterInput = { name: string; kind?: string; description?: string | null };

export function createFirmMatterService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function audit(firmId: string, actorUserId: string, action: string, targetType: string, targetId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType, targetId, metadata: metadata ?? undefined } });
  }

  function clean(input: MatterInput) {
    const name = input.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) return fail("Name the matter (2 to 80 characters).", "name");
    const kind = (input.kind || "CUSTOM") as MatterKind;
    if (!(kind in MATTER_KINDS)) return fail("Choose a kind.", "kind");
    const description = input.description?.trim() || null;
    if (description && description.length > 500) return fail("Use 500 characters or fewer.", "description");
    return { ok: true as const, data: { name, nameKey: name.toLowerCase(), kind, description } };
  }

  async function create(userId: string, input: MatterInput): Promise<{ ok: true; id: string } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const v = clean(input);
    if (!v.ok) return v;
    try {
      const m = await db.firmMatter.create({ data: { ...v.data, firmId: ctx.firm.id, createdById: userId }, select: { id: true } });
      await audit(ctx.firm.id, userId, "matter.created", "FirmMatter", m.id, { name: v.data.name, kind: v.data.kind });
      return { ok: true, id: m.id };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return fail("Your firm already has a matter with this name.", "name");
      throw err;
    }
  }

  async function update(userId: string, id: string, input: MatterInput): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const before = await db.firmMatter.findFirst({ where: { id, firmId: ctx.firm.id } });
    if (!before) return fail("Matter not found.");
    const v = clean(input);
    if (!v.ok) return v;
    const fields = [before.name !== v.data.name && "name", before.kind !== v.data.kind && "kind", (before.description ?? null) !== v.data.description && "description"].filter(
      (x): x is string => Boolean(x),
    );
    if (!fields.length) return { ok: true };
    try {
      await db.firmMatter.update({ where: { id: before.id }, data: v.data });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return fail("Your firm already has a matter with this name.", "name");
      throw err;
    }
    await audit(ctx.firm.id, userId, "matter.updated", "FirmMatter", before.id, { name: v.data.name, fields });
    return { ok: true };
  }

  async function setArchived(userId: string, id: string, archived: boolean): Promise<{ ok: true } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (ctx.membership.role === "STAFF") return fail("Only an Owner or Admin can archive matters.");
    const m = await db.firmMatter.findFirst({ where: { id, firmId: ctx.firm.id }, select: { id: true, name: true } });
    if (!m) return fail("Matter not found.");
    await db.firmMatter.update({ where: { id: m.id }, data: { archivedAt: archived ? now() : null } });
    await audit(ctx.firm.id, userId, archived ? "matter.archived" : "matter.restored", "FirmMatter", m.id, { name: m.name });
    return { ok: true };
  }

  /** Put cases into a matter, or take them out (matterId null). Cases stay in at most one matter. */
  async function setCasesMatter(userId: string, caseIds: string[], matterId: string | null): Promise<{ ok: true; moved: number } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const ids = [...new Set(caseIds.filter(Boolean))].slice(0, 200);
    if (!ids.length) return fail("Choose at least one case.", "caseIds");
    let name: string | null = null;
    if (matterId) {
      const m = await db.firmMatter.findFirst({ where: { id: matterId, firmId: ctx.firm.id, archivedAt: null }, select: { name: true } });
      if (!m) return fail("Choose an active matter.", "matterId");
      name = m.name;
    }
    // Only cases whose matter actually changes (NULL-safe: a case in no matter is "different" from any matter).
    const changes = matterId ? { OR: [{ matterId: null }, { matterId: { not: matterId } }] } : { matterId: { not: null } };
    const { count } = await db.trackedCase.updateMany({ where: { id: { in: ids }, firmId: ctx.firm.id, ...changes }, data: { matterId } });
    if (count) await audit(ctx.firm.id, userId, matterId ? "case.matter_set" : "case.matter_cleared", matterId ? "FirmMatter" : "Firm", matterId ?? ctx.firm.id, { name, cases: count });
    return { ok: true, moved: count };
  }

  async function list(userId: string, { archived = false }: { archived?: boolean } = {}) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const matters = await db.firmMatter.findMany({
      where: { firmId: ctx.firm.id, archivedAt: archived ? { not: null } : null },
      select: {
        id: true,
        name: true,
        kind: true,
        description: true,
        updatedAt: true,
        _count: { select: { cases: true, tasks: { where: { status: { in: ACTIVE } } } } },
      },
      orderBy: { name: "asc" },
    });
    return { ctx, matters };
  }

  /** Active matters for pickers (case page, task form, filters). */
  async function options(firmId: string) {
    return db.firmMatter.findMany({ where: { firmId, archivedAt: null }, select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } });
  }

  async function get(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const matter = await db.firmMatter.findFirst({ where: { id, firmId: ctx.firm.id }, include: { createdBy: { select: { name: true, email: true } } } });
    if (!matter) return null;
    // Cases not in any matter, to add from the matter page.
    const available = await db.trackedCase.findMany({
      where: { firmId: ctx.firm.id, matterId: null },
      select: { id: true, receiptMasked: true, nickname: true, formType: true, client: { select: { displayName: true } } },
      orderBy: [{ client: { displayName: "asc" } }, { createdAt: "desc" }],
      take: 500,
    });
    return { ctx, matter, available };
  }

  return { create, update, setArchived, setCasesMatter, list, options, get };
}

export type FirmMatterService = ReturnType<typeof createFirmMatterService>;
