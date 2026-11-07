import { createHash, randomUUID } from "node:crypto";
import type { DocumentKind, DocumentSource, DocumentVisibility, Prisma, PrismaClient } from "@prisma/client";
import { decryptBytes, encryptBytes } from "@/lib/crypto";
import type { FileStore } from "@/lib/storage/file-store";
import { findFirmContext } from "./service";

/**
 * A firm's documents: files linked to a case and/or client, with a kind and who can see them
 * (internal to the firm, or shared with the client on their status page).
 *
 * - Files are checked (type by their first bytes, size), encrypted with AES-256-GCM, then stored
 *   in private storage under a random key. Downloads go through the server after a firm check.
 * - Any member can upload and download; renaming, changing kind or visibility, and deleting are for
 *   the uploader, Owners and Admins. Uploads, downloads, changes and deletions are in the activity log.
 */

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // what a server upload can carry on Vercel, with room to spare
export const DOCUMENT_KINDS: Record<DocumentKind, string> = {
  USCIS_NOTICE: "USCIS notice",
  IDENTITY: "Identity (passport, ID)",
  CIVIL: "Civil document (birth, marriage)",
  FINANCIAL: "Financial (tax, pay)",
  EVIDENCE: "Evidence",
  FORM: "Form or application",
  CORRESPONDENCE: "Letter or email",
  OTHER: "Other",
};
export const DOCUMENT_VISIBILITY: Record<DocumentVisibility, string> = { INTERNAL: "Firm only", CLIENT: "Shared with client" };

/** Accepted file types, recognised by their first bytes (not the name the browser sends). */
const TYPES: { type: string; ext: string[]; test: (b: Buffer) => boolean }[] = [
  { type: "application/pdf", ext: ["pdf"], test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { type: "image/jpeg", ext: ["jpg", "jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: ["png"], test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", ext: ["webp"], test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { type: "image/heic", ext: ["heic", "heif"], test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1|heif)$/.test(b.subarray(8, 12).toString("latin1")) },
  {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ["docx"],
    test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  },
];
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.docx,application/pdf,image/*";

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

/** A safe display name: no folders, no control characters, at most 200 characters, extension kept. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "document";
  if (cleaned.length <= 200) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - ext.length) + ext;
}

export function sniffType(data: Buffer, name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const t = TYPES.find((x) => x.test(data));
  if (!t) return null;
  // A .docx is a zip: only accept zips that are named .docx.
  if (t.ext[0] === "docx" && ext !== "docx") return null;
  return t.type;
}

export type UploadInput = {
  data: Buffer;
  name: string;
  kind?: string;
  visibility?: string;
  caseId?: string | null;
  clientId?: string | null;
};
export type DocumentFilters = { scope?: "all" | "case" | "client" | "unlinked"; kind?: string; visibility?: string; source?: string; q?: string; caseId?: string; clientId?: string };

export function createFirmDocumentService({ db, store }: { db: PrismaClient; store: FileStore | null }) {
  async function audit(firmId: string, actorUserId: string, action: string, docId: string, metadata?: object) {
    await db.auditLog.create({ data: { firmId, actorUserId, action, targetType: "FirmDocument", targetId: docId, metadata: metadata ?? undefined } });
  }

  async function upload(userId: string, input: UploadInput, source: DocumentSource = "FIRM"): Promise<{ ok: true; id: string } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (!store) return fail("File storage isn't set up on this site.");
    if (!input.data.length) return fail("Choose a file.", "file");
    if (input.data.length > MAX_FILE_BYTES) return fail("Files can be up to 4 MB. Try a PDF or a smaller photo.", "file");
    const name = cleanFileName(input.name);
    const contentType = sniffType(input.data, name);
    if (!contentType) return fail("Upload a PDF, a photo (JPG, PNG, HEIC, WebP) or a Word document (.docx).", "file");
    const kind = (input.kind || "OTHER") as DocumentKind;
    if (!(kind in DOCUMENT_KINDS)) return fail("Choose what kind of document this is.", "kind");
    const visibility = (input.visibility || "INTERNAL") as DocumentVisibility;
    if (!(visibility in DOCUMENT_VISIBILITY)) return fail("Choose who can see it.", "visibility");
    const caseId = input.caseId || null;
    let clientId = input.clientId || null;
    if (caseId) {
      const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true, clientId: true } });
      if (!c) return fail("Choose one of your firm's cases.", "caseId");
      clientId = clientId ?? c.clientId;
    }
    if (clientId && !(await db.client.findFirst({ where: { id: clientId, firmId: ctx.firm.id }, select: { id: true } }))) return fail("Choose one of your firm's clients.", "clientId");
    if (visibility === "CLIENT" && !clientId) return fail("Link the document to a client to share it with them.", "visibility");

    const r = await save(ctx.firm.id, { data: input.data, name, contentType, kind, visibility, caseId, clientId, source, uploadedById: userId });
    await audit(ctx.firm.id, userId, "document.uploaded", r.id, { name, kind, visibility });
    return { ok: true, id: r.id };
  }

  /** Encrypt, store and record one already-checked file. */
  async function save(
    firmId: string,
    f: { data: Buffer; name: string; contentType: string; kind: DocumentKind; visibility: DocumentVisibility; caseId: string | null; clientId: string | null; source: DocumentSource; uploadedById: string | null; requestItemId?: string | null },
  ) {
    if (!store) throw new Error("No file store");
    const storageKey = `${firmId}/${randomUUID()}`;
    await store.put(storageKey, encryptBytes(f.data));
    try {
      return await db.firmDocument.create({
        data: {
          firmId,
          caseId: f.caseId,
          clientId: f.clientId,
          name: f.name,
          kind: f.kind,
          visibility: f.visibility,
          source: f.source,
          contentType: f.contentType,
          size: f.data.length,
          sha256: createHash("sha256").update(f.data).digest("hex"),
          storageKey,
          uploadedById: f.uploadedById,
          requestItemId: f.requestItemId ?? null,
        },
        select: { id: true },
      });
    } catch (err) {
      await store.remove(storageKey).catch(() => {});
      throw err;
    }
  }

  /** A client's upload for a document request: checked like any upload, shared with the client, no signed-in user. */
  async function saveFromClient(firmId: string, input: { data: Buffer; name: string; caseId: string | null; clientId: string; requestItemId: string }): Promise<{ ok: true; id: string; name: string } | Fail> {
    if (!store) return fail("File storage isn't set up on this site.");
    if (!input.data.length) return fail("Choose a file.", "file");
    if (input.data.length > MAX_FILE_BYTES) return fail("Files can be up to 4 MB.", "file");
    const name = cleanFileName(input.name);
    const contentType = sniffType(input.data, name);
    if (!contentType) return fail("Upload a PDF, a photo (JPG, PNG, HEIC, WebP) or a Word document (.docx).", "file");
    const r = await save(firmId, { data: input.data, name, contentType, kind: "OTHER", visibility: "CLIENT", caseId: input.caseId, clientId: input.clientId, source: "CLIENT", uploadedById: null, requestItemId: input.requestItemId });
    return { ok: true, id: r.id, name };
  }

  async function list(userId: string, filters: DocumentFilters = {}) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return null;
    const and: Prisma.FirmDocumentWhereInput[] = [{ firmId: ctx.firm.id }];
    if (filters.scope === "case") and.push({ caseId: { not: null } });
    else if (filters.scope === "client") and.push({ caseId: null, clientId: { not: null } });
    else if (filters.scope === "unlinked") and.push({ caseId: null, clientId: null });
    if (filters.kind && filters.kind in DOCUMENT_KINDS) and.push({ kind: filters.kind as DocumentKind });
    if (filters.visibility && filters.visibility in DOCUMENT_VISIBILITY) and.push({ visibility: filters.visibility as DocumentVisibility });
    if (filters.source === "FIRM" || filters.source === "CLIENT") and.push({ source: filters.source });
    if (filters.caseId) and.push({ caseId: filters.caseId });
    if (filters.clientId) and.push({ clientId: filters.clientId });
    const q = filters.q?.trim().slice(0, 80);
    if (q) {
      const contains = { contains: q, mode: "insensitive" as const };
      and.push({ OR: [{ name: contains }, { client: { displayName: contains } }, { case: { nickname: contains } }] });
    }
    const documents = await db.firmDocument.findMany({
      where: { AND: and },
      select: {
        id: true,
        name: true,
        kind: true,
        visibility: true,
        source: true,
        contentType: true,
        size: true,
        createdAt: true,
        uploadedById: true,
        uploadedBy: { select: { name: true, email: true } },
        case: { select: { id: true, receiptMasked: true, nickname: true } },
        client: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return { ctx, documents, storageReady: Boolean(store) };
  }

  /** The file, decrypted, for a member of the same firm. */
  async function download(userId: string, id: string): Promise<{ ok: true; name: string; contentType: string; data: Buffer } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (!store) return fail("File storage isn't set up on this site.");
    const d = await db.firmDocument.findFirst({ where: { id, firmId: ctx.firm.id }, select: { id: true, name: true, contentType: true, storageKey: true, size: true } });
    if (!d) return fail("Document not found.");
    const data = decryptBytes(await store.get(d.storageKey));
    await audit(ctx.firm.id, userId, "document.downloaded", d.id, { name: d.name });
    return { ok: true, name: d.name, contentType: d.contentType, data };
  }

  async function editable(userId: string, id: string) {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return { error: fail("You're not part of a firm workspace.") };
    const d = await db.firmDocument.findFirst({ where: { id, firmId: ctx.firm.id } });
    if (!d) return { error: fail("Document not found.") };
    if (d.uploadedById !== userId && ctx.membership.role === "STAFF") return { error: fail("Only the person who uploaded it, an Owner or an Admin can change this document.") };
    return { ctx, d };
  }

  async function update(userId: string, id: string, input: { name?: string; kind?: string; visibility?: string }): Promise<{ ok: true } | Fail> {
    const r = await editable(userId, id);
    if ("error" in r) return r.error!;
    const { ctx, d } = r;
    const name = input.name !== undefined ? cleanFileName(input.name) : d.name;
    const kind = (input.kind ?? d.kind) as DocumentKind;
    const visibility = (input.visibility ?? d.visibility) as DocumentVisibility;
    if (!(kind in DOCUMENT_KINDS) || !(visibility in DOCUMENT_VISIBILITY)) return fail("Choose from the list.");
    if (visibility === "CLIENT" && !d.clientId) return fail("Link the document to a client to share it with them.", "visibility");
    const fields = [name !== d.name && "name", kind !== d.kind && "kind", visibility !== d.visibility && "visibility"].filter((x): x is string => Boolean(x));
    if (!fields.length) return { ok: true };
    await db.firmDocument.update({ where: { id: d.id }, data: { name, kind, visibility } });
    await audit(ctx.firm.id, userId, "document.updated", d.id, { name, fields });
    return { ok: true };
  }

  async function remove(userId: string, id: string): Promise<{ ok: true } | Fail> {
    const r = await editable(userId, id);
    if ("error" in r) return r.error!;
    const { ctx, d } = r;
    await db.firmDocument.delete({ where: { id: d.id } });
    if (store) await store.remove(d.storageKey).catch(() => {}); // the record is gone either way; a stray encrypted blob is harmless
    await audit(ctx.firm.id, userId, "document.deleted", d.id, { name: d.name });
    return { ok: true };
  }

  /** A file the firm shared with this client (or the client uploaded), for the client's own status page. */
  async function downloadShared(firmId: string, clientId: string, id: string): Promise<{ ok: true; name: string; contentType: string; data: Buffer } | Fail> {
    if (!store) return fail("File storage isn't set up on this site.");
    const d = await db.firmDocument.findFirst({ where: { id, firmId, clientId, visibility: "CLIENT" }, select: { id: true, name: true, contentType: true, storageKey: true } });
    if (!d) return fail("Document not found.");
    const data = decryptBytes(await store.get(d.storageKey));
    await db.auditLog.create({ data: { firmId, actorUserId: null, action: "document.client_downloaded", targetType: "FirmDocument", targetId: d.id, metadata: { name: d.name } } });
    return { ok: true, name: d.name, contentType: d.contentType, data };
  }

  return { upload, saveFromClient, list, download, downloadShared, update, remove };
}

export type FirmDocumentService = ReturnType<typeof createFirmDocumentService>;
