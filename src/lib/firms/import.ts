import type { PrismaClient } from "@prisma/client";
import { parseCsv } from "@/lib/csv";
import { isValidReceiptNumber, maskReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import { protectReceipt, receiptDigestOf } from "@/lib/cases/receipt-store";
import { FIRM_CONSENT_VERSION, type FirmConsentBasis } from "./consent";
import { findFirmContext, type FirmContext } from "./service";
import { firmChecksAllowed } from "@/lib/billing/entitlements";
import { normalizeTagName, tagKey } from "@/lib/cases/tags";
import { FIRM_TAG_LIMITS, nextTagColor } from "./tags";

/**
 * Bulk-add a firm's cases from a CSV file, in two steps:
 *
 * 1. preview(): parse and validate every row and show what WOULD happen.
 *    Nothing is saved and USCIS isn't called.
 * 2. run(): the same file is sent again and re-validated from scratch on the
 *    server (the preview is never trusted), then valid rows are saved in one
 *    transaction. Rows with problems are skipped and reported.
 *
 * Imported cases aren't checked inline: they're scheduled, so the regular
 * throttled job checks them within minutes and stays under USCIS limits.
 * The firm attests once for the batch (G-28 or written consent); a row's own
 * "evidence" column overrides the default evidence reference.
 */

export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_BYTES = 256 * 1024;

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export type ImportDefaults = { basis: FirmConsentBasis; evidenceRef: string };

/** What the preview shows for one row. Never contains the full receipt number. */
export type ImportRow = {
  line: number;
  clientName: string;
  clientRef: string | null;
  receiptMasked: string | null;
  label: string | null;
  evidenceRef: string;
  newClient: boolean;
  /** Firm tags for the case (from a "tags" column); `isNew` when the firm doesn't have it yet. */
  tags: { name: string; isNew: boolean }[];
  error: string | null;
};

export type ImportPlan = { ok: true; rows: ImportRow[]; toAdd: number; newClients: number; newTags: number; errors: number };

type Resolved = ImportRow & {
  receipt?: string;
  clientId?: string;
  newClientKey?: string;
  clientEmail?: string | null;
};

// Header names, after normHeader(). Besides our template, these cover common exports from case
// management tools (Docketwise, Clio and others) and hand-made spreadsheets. When no header names
// the receipt column, the column that holds receipt numbers is found by its contents.
const COLUMNS = {
  receipt: [
    "receipt", "receipt_number", "receipt_no", "receiptnumber", "receipt_num", "uscis_receipt", "receipt_numbers", "receipt_number_s",
    "uscis_receipt_number", "uscis_receipt_no", "uscis_receipt_numbers", "case_receipt_number", "case_receipt", "receipt_s",
  ],
  client: [
    "client", "client_name", "name", "applicant", "applicant_name", "beneficiary", "beneficiary_name", "client_full_name", "full_name",
    "contact", "contact_name", "primary_client", "primary_contact", "client_display_name", "applicant_full_name",
  ],
  clientRef: [
    "client_ref", "client_reference", "reference", "ref", "matter", "matter_number", "matter_no", "file_number", "file_no",
    "display_number", "matter_display_number", "matter_id", "matter_ref", "client_number", "client_id",
  ],
  label: ["label", "nickname", "case_label", "case", "description", "matter_title", "matter_name", "matter_description", "case_name", "case_type", "form", "form_type", "petition_type"],
  tags: ["tags", "tag", "case_tags", "firm_tags"],
  evidence: ["evidence", "evidence_ref", "consent_evidence", "g28", "g_28"],
  email: ["email", "client_email", "email_address", "client_email_address", "primary_email", "contact_email"],
  firstName: ["first_name", "given_name", "client_first_name", "contact_first_name", "applicant_first_name", "beneficiary_first_name"],
  lastName: ["last_name", "family_name", "surname", "client_last_name", "contact_last_name", "applicant_last_name", "beneficiary_last_name"],
} as const;
type Col = keyof typeof COLUMNS;

const normHeader = (h: string) => h.toLowerCase().replace(/#/g, "number").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const IMPORT_TEMPLATE =
  "client_name,client_ref,receipt_number,label,evidence,tags\n" +
  "Maria Lopez,M-1001,EAC9999103402,I-130 for spouse,G-28 signed 2026-10-01,Attorney: Rivera; Family\n" +
  "John Doe,M-1002,EAC9999103403,I-765,,EAD\n";

/** Every receipt number in a piece of text ("EAC 99 991-03402, IOE0912345678" → two), normalized. */
export function receiptsInText(text: string): string[] {
  const found = text.toUpperCase().match(/\b[A-Z]{3}[\s-]*(?:\d[\s-]*){9}\d\b/g) ?? [];
  return [...new Set(found.map(normalizeReceiptNumber))].filter(isValidReceiptNumber);
}

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Pasted receipt numbers (any text: a list, an email, a spreadsheet column) for one client, as import CSV. */
export function pastedReceiptsToCsv(text: string, clientName: string, clientRef: string): { csv: string; count: number } {
  const receipts = receiptsInText(text);
  const lines = receipts.map((r) => [clientName.trim(), clientRef.trim(), r].map(csvCell).join(","));
  return { csv: ["client_name,client_ref,receipt_number", ...lines].join("\n") + "\n", count: receipts.length };
}

/** Tag names in a "tags" cell, separated by ";" or "|". */
const splitTags = (cell: string) => cell.split(/[;|]/).map((t) => t.trim()).filter(Boolean);

export function createFirmImportService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  async function plan(ctx: FirmContext, text: string, defaults: ImportDefaults): Promise<{ ok: true; rows: Resolved[] } | Fail> {
    if (Buffer.byteLength(text, "utf8") > IMPORT_MAX_BYTES) return fail("That file is too large. Split it into files of up to 200 cases.");
    if (!firmChecksAllowed(ctx.firm, now())) {
      return fail("Your free trial has ended. Choose a plan in Firm → Billing to add cases.");
    }
    const table = parseCsv(text);
    if (table.length < 2) return fail("The file needs a header row and at least one case.");
    const header = table[0].map(normHeader);
    const idx = Object.fromEntries(
      (Object.keys(COLUMNS) as Col[]).map((c) => [c, header.findIndex((h) => (COLUMNS[c] as readonly string[]).includes(h))]),
    ) as Record<Col, number>;
    const rawBody = table.slice(1);
    if (idx.receipt < 0) {
      // No header names it: use the column holding the most receipt numbers.
      let best = { col: -1, hits: 0 };
      for (let col = 0; col < header.length; col++) {
        const hits = rawBody.filter((r) => receiptsInText(r[col] ?? "").length > 0).length;
        if (hits > best.hits) best = { col, hits };
      }
      idx.receipt = best.col;
      for (const c of Object.keys(idx) as Col[]) if (c !== "receipt" && idx[c] === best.col) idx[c] = -1;
    }
    if (idx.receipt < 0) return fail('We couldn\'t find receipt numbers in this file. Add a "receipt_number" column, or download the template to see the format.');
    if (idx.client < 0 && idx.clientRef < 0 && idx.firstName < 0 && idx.lastName < 0) {
      return fail('Add a "client_name" column (or "client_ref" for existing clients).');
    }
    // One row per receipt: a cell may list several ("EAC…, IOE…"), each becomes a case for that client.
    const body = rawBody.flatMap((r, i) => {
      const raw = r[idx.receipt] ?? "";
      const found = receiptsInText(raw);
      return (found.length ? found : [normalizeReceiptNumber(raw)]).map((receipt) => ({ r, line: i + 2, receipt }));
    });
    if (body.length > IMPORT_MAX_ROWS) return fail(`Import up to ${IMPORT_MAX_ROWS} cases at a time. This file has ${body.length}.`);

    const cell = (r: string[], c: Col): string => {
      if (c === "client" && idx.client < 0) return [cell(r, "firstName"), cell(r, "lastName")].filter(Boolean).join(" ");
      return idx[c] >= 0 ? (r[idx[c]] ?? "").trim() : "";
    };
    const clients = await db.client.findMany({
      where: { firmId: ctx.firm.id },
      select: { id: true, displayName: true, externalRef: true, archivedAt: true },
    });
    const firmTags = new Map((await db.firmTag.findMany({ where: { firmId: ctx.firm.id }, select: { nameKey: true, name: true } })).map((t) => [t.nameKey, t.name]));
    const newTagNames = new Map<string, string>();
    const receipts = body.map((e) => e.receipt);
    const existing = new Set(
      (
        await db.trackedCase.findMany({
          where: { firmId: ctx.firm.id, receiptDigest: { in: receipts.filter(isValidReceiptNumber).map(receiptDigestOf) } },
          select: { receiptDigest: true },
        })
      ).map((c) => c.receiptDigest),
    );
    let remaining = ctx.firm.caseLimit - (await db.trackedCase.count({ where: { firmId: ctx.firm.id } }));

    const seen = new Set<string>();
    const newKeys = new Set<string>();
    const rows: Resolved[] = body.map(({ r, line }, i) => {
      const receipt = receipts[i];
      const clientName = cell(r, "client").slice(0, 120);
      const clientRef = cell(r, "clientRef").slice(0, 60) || null;
      const label = cell(r, "label").slice(0, 60) || null;
      const evidenceRef = (cell(r, "evidence") || defaults.evidenceRef).trim().slice(0, 200);
      const valid = isValidReceiptNumber(receipt);
      const row: Resolved = {
        line,
        clientName,
        clientRef,
        receiptMasked: valid ? maskReceiptNumber(receipt) : null,
        label,
        evidenceRef,
        newClient: false,
        tags: [],
        error: null,
        clientEmail: cell(r, "email").toLowerCase() || null,
      };
      const err = (e: string) => ({ ...row, error: e });

      if (!valid) return err("Receipt number must be 3 letters and 10 digits.");
      const digest = receiptDigestOf(receipt);
      if (seen.has(digest)) return err("This receipt number appears earlier in the file.");
      seen.add(digest);
      if (existing.has(digest)) return err("Your firm is already tracking this receipt number.");
      if (evidenceRef.length < 3) return err("Add the consent evidence (column or default below).");

      // Find the client: by your reference first, then by exact name.
      let match = clientRef ? clients.filter((c) => c.externalRef && key(c.externalRef) === key(clientRef)) : [];
      if (!match.length && clientName) match = clients.filter((c) => key(c.displayName) === key(clientName));
      if (match.length > 1) return err(`More than one client matches "${clientRef ?? clientName}". Add a client_ref to pick one.`);
      if (match[0]?.archivedAt) return err(`Client "${match[0].displayName}" is archived. Restore them first.`);
      let resolved: Resolved;
      if (match[0]) {
        resolved = { ...row, clientName: match[0].displayName, clientId: match[0].id, receipt };
      } else {
        if (clientName.length < 2) return err("Add the client's name.");
        const nk = clientRef ? `ref:${key(clientRef)}` : `name:${key(clientName)}`;
        resolved = { ...row, newClient: !newKeys.has(nk), newClientKey: nk, receipt };
        newKeys.add(nk);
      }
      // Tags: existing ones by name (any capitals); new ones are created on import.
      const tags = new Map<string, { name: string; isNew: boolean }>();
      for (const raw of splitTags(cell(r, "tags"))) {
        const name = normalizeTagName(raw, FIRM_TAG_LIMITS.name);
        if (!name) return err(`Tag "${raw.slice(0, 40)}" is longer than ${FIRM_TAG_LIMITS.name} characters.`);
        const k = tagKey(name);
        const known = firmTags.get(k) ?? newTagNames.get(k);
        tags.set(k, { name: known ?? name, isNew: !firmTags.has(k) });
      }
      if (tags.size > FIRM_TAG_LIMITS.perCase) return err(`A case can have up to ${FIRM_TAG_LIMITS.perCase} tags.`);
      const fresh = [...tags.keys()].filter((k) => !firmTags.has(k) && !newTagNames.has(k));
      if (firmTags.size + newTagNames.size + fresh.length > FIRM_TAG_LIMITS.perFirm) return err(`Over your firm's limit of ${FIRM_TAG_LIMITS.perFirm} tags.`);
      if (remaining <= 0) return err(`Over your firm's limit of ${ctx.firm.caseLimit} cases.`);
      remaining--;
      for (const k of fresh) newTagNames.set(k, tags.get(k)!.name);
      return { ...resolved, tags: [...tags.values()] };
    });
    return { ok: true, rows };
  }

  const publicRow = ({ line, clientName, clientRef, receiptMasked, label, evidenceRef, newClient, tags, error }: Resolved): ImportRow => ({
    line,
    clientName,
    clientRef,
    receiptMasked,
    label,
    evidenceRef,
    newClient,
    tags,
    error,
  });

  /** The distinct new tags the rows that will be imported need, by key. */
  const newTagsOf = (rows: Resolved[]) => {
    const m = new Map<string, string>();
    for (const r of rows) if (!r.error) for (const tg of r.tags) if (tg.isNew) m.set(tagKey(tg.name), tg.name);
    return m;
  };

  function summarize(rows: Resolved[]): ImportPlan {
    const ok = rows.filter((r) => !r.error);
    return {
      ok: true,
      rows: rows.map(publicRow),
      toAdd: ok.length,
      newClients: ok.filter((r) => r.newClient).length,
      newTags: newTagsOf(rows).size,
      errors: rows.length - ok.length,
    };
  }

  async function preview(userId: string, text: string, defaults: ImportDefaults): Promise<ImportPlan | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const p = await plan(ctx, text, defaults);
    return p.ok ? summarize(p.rows) : p;
  }

  async function run(
    userId: string,
    text: string,
    defaults: ImportDefaults,
  ): Promise<{ ok: true; added: number; newClients: number; newTags: number; skipped: number } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const p = await plan(ctx, text, defaults);
    if (!p.ok) return p;
    const good = p.rows.filter((r) => !r.error);
    if (!good.length) return fail("No rows can be imported. Fix the problems shown and try again.");
    const t = now();

    try {
      const newTags = newTagsOf(p.rows);
      const newClientIds = await db.$transaction(
        async (tx) => {
          const ids = new Map<string, string>();
          // Firm tags by key: the existing ones, plus the new ones this file needs.
          const existingTags = await tx.firmTag.findMany({ where: { firmId: ctx.firm.id }, select: { id: true, nameKey: true, color: true } });
          const tagIds = new Map(existingTags.map((t) => [t.nameKey, t.id]));
          const colors = existingTags.map((t) => ({ color: t.color }));
          for (const [k, name] of newTags) {
            const color = nextTagColor(colors);
            colors.push({ color });
            const tag = await tx.firmTag.create({ data: { firmId: ctx.firm.id, name, nameKey: k, color }, select: { id: true } });
            tagIds.set(k, tag.id);
            await tx.auditLog.create({
              data: { firmId: ctx.firm.id, actorUserId: userId, action: "tag.created", targetType: "FirmTag", targetId: tag.id, metadata: { name, color, source: "csv" } },
            });
          }
          for (const r of good) {
            let clientId = r.clientId;
            if (!clientId) {
              clientId = ids.get(r.newClientKey!);
              if (!clientId) {
                const c = await tx.client.create({
                  data: { firmId: ctx.firm.id, displayName: r.clientName, externalRef: r.clientRef, email: r.clientEmail, createdById: userId },
                });
                ids.set(r.newClientKey!, c.id);
                clientId = c.id;
                await tx.auditLog.create({
                  data: { firmId: ctx.firm.id, actorUserId: userId, action: "client.created", targetType: "Client", targetId: c.id, metadata: { source: "csv" } },
                });
              }
            }
            const created = await tx.trackedCase.create({
              data: {
                ...protectReceipt(r.receipt!),
                nickname: r.label,
                firmId: ctx.firm.id,
                clientId,
                addedById: userId,
                nextCheckAt: t, // picked up by the next scheduled (throttled) run
                consents: {
                  create: {
                    basis: defaults.basis,
                    source: "CSV_IMPORT",
                    statementVersion: FIRM_CONSENT_VERSION,
                    evidenceRef: r.evidenceRef,
                    grantedById: userId,
                    capturedAt: t,
                  },
                },
              },
            });
            await tx.auditLog.create({
              data: {
                firmId: ctx.firm.id,
                actorUserId: userId,
                action: "case.created",
                targetType: "TrackedCase",
                targetId: created.id,
                metadata: { basis: defaults.basis, clientId, source: "csv" },
              },
            });
            if (r.tags.length) {
              await tx.firmCaseTag.createMany({
                data: r.tags.map((tg) => ({ caseId: created.id, tagId: tagIds.get(tagKey(tg.name))!, firmId: ctx.firm.id })),
                skipDuplicates: true,
              });
            }
          }
          await tx.auditLog.create({
            data: {
              firmId: ctx.firm.id,
              actorUserId: userId,
              action: "cases.imported",
              targetType: "Firm",
              targetId: ctx.firm.id,
              metadata: { added: good.length, newClients: ids.size, ...(newTags.size ? { newTags: newTags.size } : {}), skipped: p.rows.length - good.length },
            },
          });
          return ids;
        },
        { timeout: 60_000 },
      );
      return { ok: true, added: good.length, newClients: newClientIds.size, newTags: newTags.size, skipped: p.rows.length - good.length };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return fail("Some of these cases or tags were added by someone else in the meantime. Preview the file again.");
      }
      throw err;
    }
  }

  return { preview, run };
}

export type FirmImportService = ReturnType<typeof createFirmImportService>;
