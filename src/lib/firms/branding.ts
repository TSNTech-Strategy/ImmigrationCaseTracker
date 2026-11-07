import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { decryptBytes, encryptBytes } from "@/lib/crypto";
import type { FileStore } from "@/lib/storage/file-store";
import { findFirmContext } from "./service";

/**
 * The firm's logo: shown to clients on their status page, the document upload page and in emails.
 *
 * - Owners and Admins upload a PNG, JPEG or WebP up to 512 KB; the type is checked by its first bytes.
 * - Stored encrypted like every other file, served by `/brand/[firmId]/logo` (a logo isn't secret,
 *   so that route is public and cacheable; the version in the URL changes with every new logo).
 */

export const MAX_LOGO_BYTES = 512 * 1024;
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export function logoType(b: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Where the logo is served, or null when the firm has none. */
export function logoPath(firm: { id: string; logoKey: string | null; logoVersion: number }): string | null {
  return firm.logoKey ? `/brand/${firm.id}/logo?v=${firm.logoVersion}` : null;
}

export function createFirmBrandingService({ db, store }: { db: PrismaClient; store: FileStore | null }) {
  async function manager(userId: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return { error: fail("You're not part of a firm workspace.") };
    if (ctx.membership.role === "STAFF") return { error: fail("Only an Owner or Admin can change the firm's logo.") };
    return { ctx };
  }

  async function setLogo(userId: string, file: { data: Buffer; name: string }): Promise<{ ok: true } | Fail> {
    const r = await manager(userId);
    if ("error" in r) return r.error!;
    const { firm } = r.ctx;
    if (!store) return fail("File storage isn't set up on this site.");
    if (!file.data.length) return fail("Choose an image.", "logo");
    if (file.data.length > MAX_LOGO_BYTES) return fail("The logo can be up to 512 KB. Try a smaller PNG or JPG.", "logo");
    const contentType = logoType(file.data);
    if (!contentType) return fail("Upload a PNG, JPG or WebP image.", "logo");
    const key = `${firm.id}/brand/${randomUUID()}`;
    await store.put(key, encryptBytes(file.data));
    const updated = await db.firm.updateMany({ where: { id: firm.id, logoVersion: firm.logoVersion }, data: { logoKey: key, logoContentType: contentType, logoVersion: { increment: 1 } } });
    if (updated.count === 0) {
      // Someone else changed the logo at the same moment; keep theirs.
      await store.remove(key).catch(() => {});
      return fail("The logo was just changed by someone else. Refresh and try again.");
    }
    if (firm.logoKey) await store.remove(firm.logoKey).catch(() => {});
    await db.auditLog.create({ data: { firmId: firm.id, actorUserId: userId, action: "firm.logo_updated", targetType: "Firm", targetId: firm.id } });
    return { ok: true };
  }

  async function removeLogo(userId: string): Promise<{ ok: true } | Fail> {
    const r = await manager(userId);
    if ("error" in r) return r.error!;
    const { firm } = r.ctx;
    if (!firm.logoKey) return { ok: true };
    await db.firm.update({ where: { id: firm.id }, data: { logoKey: null, logoContentType: null, logoVersion: { increment: 1 } } });
    if (store) await store.remove(firm.logoKey).catch(() => {});
    await db.auditLog.create({ data: { firmId: firm.id, actorUserId: userId, action: "firm.logo_removed", targetType: "Firm", targetId: firm.id } });
    return { ok: true };
  }

  /** The logo bytes for the public route; null when there's none (or the firm is closed). */
  async function getLogo(firmId: string): Promise<{ data: Buffer; contentType: string; version: number } | null> {
    if (!store) return null;
    const firm = await db.firm.findFirst({ where: { id: firmId, status: "ACTIVE" }, select: { logoKey: true, logoContentType: true, logoVersion: true } });
    if (!firm?.logoKey || !firm.logoContentType) return null;
    try {
      return { data: decryptBytes(await store.get(firm.logoKey)), contentType: firm.logoContentType, version: firm.logoVersion };
    } catch {
      return null;
    }
  }

  return { setLogo, removeLogo, getLogo };
}
