import type { FirmRole, Prisma, PrismaClient, TrackedCase } from "@prisma/client";
import { isValidReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import { caseViewSelect, type CaseService, type RefreshResult } from "@/lib/cases/service";
import { InvalidReceiptError, protectReceipt, receiptDigestOf } from "@/lib/cases/receipt-store";
import { FIRM_CONSENT_VERSION, type FirmConsentBasis } from "./consent";
import { findFirmContext, type FirmContext } from "./service";

/**
 * A firm's clients and the cases it tracks for them (CasePingo Pro).
 *
 * Rules
 * - Every query is scoped to the caller's own firm, read fresh from the
 *   database. Another firm's client or case looks exactly like a missing one.
 * - Any member can add clients and cases, refresh, and withdraw or record
 *   consent. Archiving clients and removing cases: Owner or Admin.
 * - A case needs an attestation (G-28 or written client consent) with the
 *   firm's own evidence reference. Without active consent it isn't checked.
 * - New cases stop at the firm's case limit and when the trial has ended.
 * - Every change is audit-logged with the firm id. Client contact details are
 *   never copied into the audit log.
 */

type Fail = { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): Fail => ({ ok: false, error, field });

export type ClientInput = { displayName: string; email?: string | null; phone?: string | null; externalRef?: string | null };
export type FirmCaseInput = { clientId: string; receipt: string; nickname?: string | null; basis: FirmConsentBasis; evidenceRef: string };

export const CASE_VIEWS = {
  changed: "Changed in the last 7 days",
  failed: "Last check failed",
  no_consent: "No active consent",
  unchecked: "Not checked yet",
} as const;
export type CaseListView = keyof typeof CASE_VIEWS;
export const CASE_SORTS = {
  added: "Recently added",
  changed: "Recently changed",
  checked: "Recently checked",
  client: "Client name",
} as const;
export type CaseSort = keyof typeof CASE_SORTS;
export type CaseFilters = { clientId?: string; q?: string; view?: CaseListView; sort?: CaseSort };
export const LIST_LIMIT = 100;

const SORTS: Record<CaseSort, Prisma.TrackedCaseOrderByWithRelationInput[]> = {
  added: [{ createdAt: "desc" }],
  changed: [{ lastChangeObservedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  checked: [{ lastCheckedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  client: [{ client: { displayName: "asc" } }, { createdAt: "desc" }],
};

function viewWhere(view: CaseListView, t: Date): Prisma.TrackedCaseWhereInput {
  switch (view) {
    case "changed":
      return { lastChangeObservedAt: { gte: new Date(t.getTime() - 7 * 86_400_000) } };
    case "failed":
      return { AND: [{ lastCheckOutcome: { not: null } }, { lastCheckOutcome: { not: "ok" } }] };
    case "no_consent":
      return { consents: { none: { withdrawnAt: null } } };
    case "unchecked":
      return { lastCheckedAt: null };
  }
}

const isManager = (role: FirmRole) => role === "OWNER" || role === "ADMIN";

export type FirmCaseServiceDeps = { db: PrismaClient; cases: Pick<CaseService, "runCheck" | "refreshFirmCase">; now?: () => Date };

export function createFirmCaseService({ db, cases, now = () => new Date() }: FirmCaseServiceDeps) {
  const ctxOf = (userId: string) => findFirmContext(db, userId);

  async function audit(ctx: FirmContext, action: string, targetType: string, targetId: string, metadata?: object) {
    await db.auditLog.create({
      data: { firmId: ctx.firm.id, actorUserId: ctx.membership.userId, action, targetType, targetId, metadata: metadata ?? undefined },
    });
  }

  function cleanClient(input: ClientInput): { ok: true; data: Required<ClientInput> } | Fail {
    const displayName = input.displayName.trim().slice(0, 120);
    if (displayName.length < 2) return fail("Enter the client's name.", "displayName");
    const email = input.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address, or leave it blank.", "email");
    const phone = input.phone?.trim() || null;
    if (phone && (phone.length > 40 || !/^[0-9+().\-\s]+$/.test(phone))) return fail("Enter a valid phone number, or leave it blank.", "phone");
    const externalRef = input.externalRef?.trim() || null;
    if (externalRef && externalRef.length > 60) return fail("Use 60 characters or fewer.", "externalRef");
    return { ok: true, data: { displayName, email, phone, externalRef } };
  }

  // ---- Clients --------------------------------------------------------------

  async function listClients(userId: string, { archived = false }: { archived?: boolean } = {}) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const clients = await db.client.findMany({
      where: { firmId: ctx.firm.id, archivedAt: archived ? { not: null } : null },
      select: { id: true, displayName: true, email: true, externalRef: true, archivedAt: true, _count: { select: { cases: true } } },
      orderBy: { displayName: "asc" },
    });
    return { ctx, clients };
  }

  async function getClient(userId: string, clientId: string) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const client = await db.client.findFirst({
      where: { id: clientId, firmId: ctx.firm.id },
      include: { cases: { select: caseViewSelect, orderBy: { createdAt: "desc" } } },
    });
    return client ? { ctx, client } : null;
  }

  async function createClient(userId: string, input: ClientInput): Promise<{ ok: true; clientId: string } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const v = cleanClient(input);
    if (!v.ok) return v;
    const client = await db.client.create({ data: { ...v.data, firmId: ctx.firm.id, createdById: userId } });
    await audit(ctx, "client.created", "Client", client.id);
    return { ok: true, clientId: client.id };
  }

  async function updateClient(userId: string, clientId: string, input: ClientInput): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const v = cleanClient(input);
    if (!v.ok) return v;
    const before = await db.client.findFirst({ where: { id: clientId, firmId: ctx.firm.id } });
    if (!before) return fail("Client not found.");
    await db.client.update({ where: { id: before.id }, data: v.data });
    const changed = (Object.keys(v.data) as (keyof ClientInput)[]).filter((k) => (before[k] ?? null) !== v.data[k]);
    if (changed.length) await audit(ctx, "client.updated", "Client", before.id, { fields: changed });
    return { ok: true };
  }

  async function setClientArchived(userId: string, clientId: string, archived: boolean): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (!isManager(ctx.membership.role)) return fail("Only an Owner or Admin can archive clients.");
    const { count } = await db.client.updateMany({
      where: { id: clientId, firmId: ctx.firm.id },
      data: { archivedAt: archived ? now() : null },
    });
    if (count === 0) return fail("Client not found.");
    await audit(ctx, archived ? "client.archived" : "client.restored", "Client", clientId);
    return { ok: true };
  }

  // ---- Cases ----------------------------------------------------------------

  async function listCases(userId: string, filters: CaseFilters = {}) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const t = now();
    const and: Prisma.TrackedCaseWhereInput[] = [{ firmId: ctx.firm.id }];
    if (filters.clientId) and.push({ clientId: filters.clientId });
    if (filters.view) and.push(viewWhere(filters.view, t));
    const q = filters.q?.trim().slice(0, 80);
    if (q) {
      const receipt = normalizeReceiptNumber(q);
      if (isValidReceiptNumber(receipt)) {
        // A full receipt number: exact match on the keyed digest (it's never stored in plain text).
        and.push({ receiptDigest: receiptDigestOf(receipt) });
      } else {
        const contains = { contains: q, mode: "insensitive" as const };
        and.push({
          OR: [
            { nickname: contains },
            { formType: contains },
            { client: { displayName: contains } },
            { client: { externalRef: contains } },
            ...(/^\d{1,3}$/.test(q) ? [{ receiptMasked: { endsWith: q } }] : []),
          ],
        });
      }
    }
    const rows = await db.trackedCase.findMany({
      where: { AND: and },
      select: {
        ...caseViewSelect,
        client: { select: { id: true, displayName: true } },
        consents: { where: { withdrawnAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: SORTS[filters.sort ?? "added"],
      take: LIST_LIMIT + 1,
    });
    return {
      ctx,
      truncated: rows.length > LIST_LIMIT,
      cases: rows.slice(0, LIST_LIMIT).map(({ consents, ...c }) => ({ ...c, hasConsent: consents.length > 0 })),
    };
  }

  async function getCase(userId: string, caseId: string) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const c = await db.trackedCase.findFirst({
      where: { id: caseId, firmId: ctx.firm.id },
      select: {
        ...caseViewSelect,
        client: { select: { id: true, displayName: true, externalRef: true } },
        addedBy: { select: { name: true, email: true } },
        events: { orderBy: { firstObservedAt: "desc" }, take: 50 },
        consents: {
          orderBy: { capturedAt: "desc" },
          take: 10,
          select: {
            id: true,
            basis: true,
            evidenceRef: true,
            capturedAt: true,
            withdrawnAt: true,
            grantedBy: { select: { name: true, email: true } },
            withdrawnBy: { select: { name: true, email: true } },
          },
        },
      },
    });
    return c ? { ctx, case: c } : null;
  }

  async function addCase(
    userId: string,
    input: FirmCaseInput,
  ): Promise<{ ok: true; caseId: string; check: RefreshResult } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");

    const evidenceRef = input.evidenceRef.trim().slice(0, 200);
    if (evidenceRef.length < 3) return fail("Describe the consent evidence you have on file.", "evidenceRef");

    let receipt;
    try {
      receipt = protectReceipt(input.receipt);
    } catch (err) {
      if (err instanceof InvalidReceiptError) return fail(err.message, "receipt");
      throw err;
    }

    const client = await db.client.findFirst({ where: { id: input.clientId, firmId: ctx.firm.id }, select: { id: true, archivedAt: true } });
    if (!client) return fail("Choose a client.", "clientId");
    if (client.archivedAt) return fail("This client is archived. Restore the client first.", "clientId");

    const t = now();
    if (ctx.firm.trialEndsAt && ctx.firm.trialEndsAt <= t) {
      return fail("Your free trial has ended, so new cases can't be added yet. Paid plans are coming soon.");
    }
    if ((await db.trackedCase.count({ where: { firmId: ctx.firm.id } })) >= ctx.firm.caseLimit) {
      return fail(`Your firm's plan includes up to ${ctx.firm.caseLimit} cases.`);
    }
    const dup = await db.trackedCase.findUnique({
      where: { firmId_receiptDigest: { firmId: ctx.firm.id, receiptDigest: receipt.receiptDigest } },
      select: { id: true },
    });
    if (dup) return fail("Your firm is already tracking this receipt number.", "receipt");

    let created: TrackedCase;
    try {
      created = await db.$transaction(async (tx) => {
        const c = await tx.trackedCase.create({
          data: {
            ...receipt,
            nickname: input.nickname?.trim().slice(0, 60) || null,
            firmId: ctx.firm.id,
            clientId: client.id,
            addedById: userId,
            consents: {
              create: {
                basis: input.basis,
                source: "FIRM_ATTESTATION",
                statementVersion: FIRM_CONSENT_VERSION,
                evidenceRef,
                grantedById: userId,
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
            targetId: c.id,
            metadata: { basis: input.basis, clientId: client.id },
          },
        });
        return c;
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return fail("Your firm is already tracking this receipt number.", "receipt");
      throw err;
    }
    const check = await cases.runCheck(created, "INITIAL");
    return { ok: true, caseId: created.id, check };
  }

  async function refreshCase(userId: string, caseId: string): Promise<RefreshResult> {
    const ctx = await ctxOf(userId);
    if (!ctx) return { status: "not_found", message: "Case not found." };
    return cases.refreshFirmCase(ctx.firm.id, caseId);
  }

  async function withdrawConsent(userId: string, caseId: string): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true } });
    if (!c) return fail("Case not found.");
    const { count } = await db.caseConsent.updateMany({
      where: { caseId: c.id, withdrawnAt: null },
      data: { withdrawnAt: now(), withdrawnById: userId },
    });
    if (count === 0) return fail("Consent was already withdrawn.");
    await audit(ctx, "consent.withdrawn", "TrackedCase", c.id);
    return { ok: true };
  }

  async function recordConsent(userId: string, caseId: string, basis: FirmConsentBasis, evidenceRefInput: string): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const evidenceRef = evidenceRefInput.trim().slice(0, 200);
    if (evidenceRef.length < 3) return fail("Describe the consent evidence you have on file.", "evidenceRef");
    const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true } });
    if (!c) return fail("Case not found.");
    const t = now();
    await db.$transaction([
      db.caseConsent.updateMany({ where: { caseId: c.id, withdrawnAt: null }, data: { withdrawnAt: t, withdrawnById: userId } }),
      db.caseConsent.create({
        data: { caseId: c.id, basis, source: "FIRM_ATTESTATION", statementVersion: FIRM_CONSENT_VERSION, evidenceRef, grantedById: userId, capturedAt: t },
      }),
      // Check soon after consent is restored.
      db.trackedCase.update({ where: { id: c.id }, data: { nextCheckAt: t } }),
    ]);
    await audit(ctx, "consent.recorded", "TrackedCase", c.id, { basis });
    return { ok: true };
  }

  async function removeCase(userId: string, caseId: string): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (!isManager(ctx.membership.role)) return fail("Only an Owner or Admin can remove cases.");
    const removed = await db.$transaction(async (tx) => {
      const { count } = await tx.trackedCase.deleteMany({ where: { id: caseId, firmId: ctx.firm.id } });
      if (count === 0) return false;
      await tx.auditLog.create({
        data: { firmId: ctx.firm.id, actorUserId: userId, action: "case.removed", targetType: "TrackedCase", targetId: caseId },
      });
      return true;
    });
    return removed ? { ok: true } : fail("Case not found.");
  }

  /** Dashboard numbers. Takes a context from getContext/listTeam (already membership-checked). */
  async function counts({ firm }: FirmContext) {
    const firmId = firm.id;
    const t = now();
    const n = (view: CaseListView) => db.trackedCase.count({ where: { AND: [{ firmId }, viewWhere(view, t)] } });
    const [clients, cases, unconsented, changed, failed, unchecked] = await Promise.all([
      db.client.count({ where: { firmId, archivedAt: null } }),
      db.trackedCase.count({ where: { firmId } }),
      n("no_consent"),
      n("changed"),
      n("failed"),
      n("unchecked"),
    ]);
    return { clients, cases, unconsented, changed, failed, unchecked };
  }

  return {
    listClients,
    getClient,
    createClient,
    updateClient,
    setClientArchived,
    listCases,
    getCase,
    addCase,
    refreshCase,
    withdrawConsent,
    recordConsent,
    removeCase,
    counts,
  };
}

export type FirmCaseService = ReturnType<typeof createFirmCaseService>;
