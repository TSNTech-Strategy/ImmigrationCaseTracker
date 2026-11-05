import type { PrismaClient } from "@prisma/client";
import { parseCsv } from "@/lib/csv";
import { isValidReceiptNumber, maskReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import { protectReceipt, receiptDigestOf } from "@/lib/cases/receipt-store";
import { FIRM_CONSENT_VERSION, type FirmConsentBasis } from "./consent";
import { findFirmContext, type FirmContext } from "./service";
import { firmChecksAllowed } from "@/lib/billing/entitlements";

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
  error: string | null;
};

export type ImportPlan = { ok: true; rows: ImportRow[]; toAdd: number; newClients: number; errors: number };

type Resolved = ImportRow & {
  receipt?: string;
  clientId?: string;
  newClientKey?: string;
  clientEmail?: string | null;
};

const COLUMNS = {
  receipt: ["receipt", "receipt_number", "receipt_no", "receiptnumber", "receipt_num", "uscis_receipt"],
  client: ["client", "client_name", "name", "applicant", "applicant_name", "beneficiary"],
  clientRef: ["client_ref", "client_reference", "reference", "ref", "matter", "matter_number", "matter_no", "file_number"],
  label: ["label", "nickname", "case_label", "case", "description"],
  evidence: ["evidence", "evidence_ref", "consent_evidence", "g28", "g_28"],
  email: ["email", "client_email"],
} as const;
type Col = keyof typeof COLUMNS;

const normHeader = (h: string) => h.toLowerCase().replace(/#/g, "number").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const IMPORT_TEMPLATE =
  "client_name,client_ref,receipt_number,label,evidence\n" +
  "Maria Lopez,M-1001,EAC9999103402,I-130 for spouse,G-28 signed 2026-10-01\n" +
  "John Doe,M-1002,EAC9999103403,I-765,\n";

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
    if (idx.receipt < 0) return fail('Add a "receipt_number" column. Download the template to see the format.');
    if (idx.client < 0 && idx.clientRef < 0) return fail('Add a "client_name" column (or "client_ref" for existing clients).');
    const body = table.slice(1);
    if (body.length > IMPORT_MAX_ROWS) return fail(`Import up to ${IMPORT_MAX_ROWS} cases at a time. This file has ${body.length}.`);

    const cell = (r: string[], c: Col) => (idx[c] >= 0 ? (r[idx[c]] ?? "").trim() : "");
    const clients = await db.client.findMany({
      where: { firmId: ctx.firm.id },
      select: { id: true, displayName: true, externalRef: true, archivedAt: true },
    });
    const receipts = body.map((r) => normalizeReceiptNumber(cell(r, "receipt")));
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
    const rows: Resolved[] = body.map((r, i) => {
      const receipt = receipts[i];
      const clientName = cell(r, "client").slice(0, 120);
      const clientRef = cell(r, "clientRef").slice(0, 60) || null;
      const label = cell(r, "label").slice(0, 60) || null;
      const evidenceRef = (cell(r, "evidence") || defaults.evidenceRef).trim().slice(0, 200);
      const valid = isValidReceiptNumber(receipt);
      const row: Resolved = {
        line: i + 2,
        clientName,
        clientRef,
        receiptMasked: valid ? maskReceiptNumber(receipt) : null,
        label,
        evidenceRef,
        newClient: false,
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
      if (remaining <= 0) return err(`Over your firm's limit of ${ctx.firm.caseLimit} cases.`);
      remaining--;
      return resolved;
    });
    return { ok: true, rows };
  }

  const publicRow = ({ line, clientName, clientRef, receiptMasked, label, evidenceRef, newClient, error }: Resolved): ImportRow => ({
    line,
    clientName,
    clientRef,
    receiptMasked,
    label,
    evidenceRef,
    newClient,
    error,
  });

  function summarize(rows: Resolved[]): ImportPlan {
    const ok = rows.filter((r) => !r.error);
    return {
      ok: true,
      rows: rows.map(publicRow),
      toAdd: ok.length,
      newClients: ok.filter((r) => r.newClient).length,
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
  ): Promise<{ ok: true; added: number; newClients: number; skipped: number } | Fail> {
    const ctx = await findFirmContext(db, userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const p = await plan(ctx, text, defaults);
    if (!p.ok) return p;
    const good = p.rows.filter((r) => !r.error);
    if (!good.length) return fail("No rows can be imported. Fix the problems shown and try again.");
    const t = now();

    try {
      const newClientIds = await db.$transaction(
        async (tx) => {
          const ids = new Map<string, string>();
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
          }
          await tx.auditLog.create({
            data: {
              firmId: ctx.firm.id,
              actorUserId: userId,
              action: "cases.imported",
              targetType: "Firm",
              targetId: ctx.firm.id,
              metadata: { added: good.length, newClients: ids.size, skipped: p.rows.length - good.length },
            },
          });
          return ids;
        },
        { timeout: 60_000 },
      );
      return { ok: true, added: good.length, newClients: newClientIds.size, skipped: p.rows.length - good.length };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return fail("Some of these cases were added by someone else in the meantime. Preview the file again.");
      }
      throw err;
    }
  }

  return { preview, run };
}

export type FirmImportService = ReturnType<typeof createFirmImportService>;
