import type { FirmRole, Prisma, PrismaClient, TrackedCase } from "@prisma/client";
import { isValidReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import { caseViewSelect, type CaseService, type RefreshResult } from "@/lib/cases/service";
import { InvalidReceiptError, protectReceipt, receiptDigestOf } from "@/lib/cases/receipt-store";
import { FIRM_CONSENT_VERSION, type FirmConsentBasis } from "./consent";
import { findFirmContext, type FirmContext } from "./service";
import { firmChecksAllowed } from "@/lib/billing/entitlements";
import { flatTags } from "@/lib/cases/tags";
import { firmCaseTagsSelect } from "./tags";
import { decrypt, encrypt } from "@/lib/crypto";
import { revealReceipt } from "@/lib/cases/receipt-store";
import { csvCell } from "@/lib/csv";
import { CASE_CATEGORIES, CATEGORY_LABEL, caseCategory, categoryFormVariants, cleanANumber, cleanBirthDate, countryName, formatANumber, isCountryCode, type CaseCategory } from "./profile";

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

export type ClientInput = {
  /** Used when first and last name aren't given (imports). */
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  /** "YYYY-MM-DD"; stored encrypted. */
  dateOfBirth?: string | null;
  countryOfBirth?: string | null;
  citizenship?: string | null;
  /** Stored encrypted; only the last 4 digits are kept in the clear. */
  aNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  externalRef?: string | null;
  /** "en" or "es": the language of the client's update emails and status page. */
  locale?: string | null;
  /** The firm records that the client agreed to case updates by email. Left out: unchanged. */
  updatesConsent?: boolean;
};
type CleanClient = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  countryOfBirth: string | null;
  citizenship: string | null;
  email: string | null;
  phone: string | null;
  externalRef: string | null;
  locale: "en" | "es";
};
type CleanSensitive = { dateOfBirth: string | null; aNumber: string | null };
export type FirmCaseInput = { clientId: string; receipt: string; nickname?: string | null; basis: FirmConsentBasis; evidenceRef: string; assigneeId?: string | null };

/** Field names for the activity log (values are never logged). */
const FIELD_LABELS: Record<string, string> = {
  displayName: "name",
  firstName: "first name",
  lastName: "last name",
  countryOfBirth: "country of birth",
  citizenship: "citizenship",
  email: "email",
  phone: "phone",
  externalRef: "reference",
  locale: "language",
  dateOfBirth: "date of birth",
  aNumber: "A-Number",
};

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
/** assignee: a member's id, "me" (the viewer) or "none" (unassigned). */
export type CaseFilters = { clientId?: string; tagId?: string; q?: string; view?: CaseListView; sort?: CaseSort; assignee?: string; category?: CaseCategory };
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

  function cleanClient(input: ClientInput): { ok: true; data: CleanClient; sensitive: CleanSensitive } | Fail {
    const firstName = input.firstName?.trim().replace(/\s+/g, " ").slice(0, 60) || null;
    const lastName = input.lastName?.trim().replace(/\s+/g, " ").slice(0, 60) || null;
    if ((firstName || lastName) && !(firstName && lastName)) return fail(firstName ? "Enter the client's last name." : "Enter the client's first name.", firstName ? "lastName" : "firstName");
    const displayName = (firstName && lastName ? `${firstName} ${lastName}` : (input.displayName ?? "")).trim().slice(0, 120);
    if (displayName.length < 2) return fail("Enter the client's name.", input.firstName !== undefined ? "firstName" : "displayName");
    const email = input.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address, or leave it blank.", "email");
    const phone = input.phone?.trim() || null;
    if (phone && (phone.length > 40 || !/^[0-9+().\-\s]+$/.test(phone))) return fail("Enter a valid phone number, or leave it blank.", "phone");
    const externalRef = input.externalRef?.trim() || null;
    if (externalRef && externalRef.length > 60) return fail("Use 60 characters or fewer.", "externalRef");
    const locale = input.locale === "es" ? "es" : "en";
    if (input.updatesConsent && !email) return fail("Add the client's email address to send them updates.", "email");
    const countryOfBirth = input.countryOfBirth?.trim().toUpperCase() || null;
    if (countryOfBirth && !isCountryCode(countryOfBirth)) return fail("Choose a country from the list.", "countryOfBirth");
    const citizenship = input.citizenship?.trim().toUpperCase() || null;
    if (citizenship && !isCountryCode(citizenship)) return fail("Choose a country from the list.", "citizenship");
    const dobRaw = input.dateOfBirth?.trim() || null;
    const dateOfBirth = dobRaw ? cleanBirthDate(dobRaw, now()) : null;
    if (dobRaw && !dateOfBirth) return fail("Enter a real date of birth, like 1990-04-21.", "dateOfBirth");
    const aRaw = input.aNumber?.trim() || null;
    const aNumber = aRaw ? cleanANumber(aRaw) : null;
    if (aRaw && !aNumber) return fail("An A-Number has 8 or 9 digits, like A123-456-789.", "aNumber");
    return { ok: true, data: { displayName, firstName, lastName, countryOfBirth, citizenship, email, phone, externalRef, locale }, sensitive: { dateOfBirth, aNumber } };
  }

  /** The database columns for the encrypted fields (only the A-Number's last 4 digits in the clear). */
  const sensitiveColumns = (s: CleanSensitive) => ({
    dateOfBirthEnc: s.dateOfBirth ? encrypt(s.dateOfBirth) : null,
    aNumberEnc: s.aNumber ? encrypt(s.aNumber) : null,
    aNumberLast4: s.aNumber ? s.aNumber.slice(-4) : null,
  });
  const readSensitive = (c: { dateOfBirthEnc: string | null; aNumberEnc: string | null }): CleanSensitive => ({
    dateOfBirth: c.dateOfBirthEnc ? decrypt(c.dateOfBirthEnc) : null,
    aNumber: c.aNumberEnc ? decrypt(c.aNumberEnc) : null,
  });

  // ---- Clients --------------------------------------------------------------

  async function listClients(userId: string, { archived = false, q, country }: { archived?: boolean; q?: string; country?: string } = {}) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const search = q?.trim().slice(0, 80);
    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined;
    const [rows, open] = await Promise.all([
      db.client.findMany({
        where: {
          firmId: ctx.firm.id,
          archivedAt: archived ? { not: null } : null,
          ...(country ? { countryOfBirth: country } : {}),
          ...(contains ? { OR: [{ displayName: contains }, { email: contains }, { externalRef: contains }, { phone: contains }] } : {}),
        },
        select: { id: true, displayName: true, email: true, phone: true, externalRef: true, locale: true, countryOfBirth: true, archivedAt: true, _count: { select: { cases: true } } },
        orderBy: { displayName: "asc" },
      }),
      // "Needs action": open items in the Updates inbox on the client's cases.
      db.firmUpdate.findMany({ where: { firmId: ctx.firm.id, OR: [{ state: "OPEN" }, { state: "SNOOZED", snoozedUntil: { lte: now() } }] }, select: { case: { select: { clientId: true } } } }),
    ]);
    const needs = new Map<string, number>();
    for (const u of open) if (u.case?.clientId) needs.set(u.case.clientId, (needs.get(u.case.clientId) ?? 0) + 1);
    const clients = rows.map((c) => ({ ...c, countryName: countryName(c.countryOfBirth), needsAction: needs.get(c.id) ?? 0 }));
    return { ctx, clients };
  }

  async function getClient(userId: string, clientId: string) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const client = await db.client.findFirst({
      where: { id: clientId, firmId: ctx.firm.id },
      include: { cases: { select: { ...caseViewSelect, ...firmCaseTagsSelect }, orderBy: { createdAt: "desc" } } },
    });
    if (!client) return null;
    const { dateOfBirthEnc, aNumberEnc, ...rest } = client;
    const sensitive = readSensitive({ dateOfBirthEnc, aNumberEnc });
    return {
      ctx,
      client: {
        ...rest,
        dateOfBirth: sensitive.dateOfBirth,
        aNumber: sensitive.aNumber ? formatANumber(sensitive.aNumber) : null,
        cases: client.cases.map(({ firmTags, ...c }) => ({ ...c, tags: flatTags(firmTags) })),
      },
    };
  }

  async function createClient(userId: string, input: ClientInput): Promise<{ ok: true; clientId: string } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const v = cleanClient(input);
    if (!v.ok) return v;
    const client = await db.client.create({ data: { ...v.data, ...sensitiveColumns(v.sensitive), updatesConsentAt: input.updatesConsent ? now() : null, firmId: ctx.firm.id, createdById: userId } });
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
    const updatesConsentAt = input.updatesConsent === undefined ? before.updatesConsentAt : input.updatesConsent ? (before.updatesConsentAt ?? now()) : null;
    // Fields a form didn't send (imports, older forms) keep their stored values.
    const prior = readSensitive(before);
    const sensitive: CleanSensitive = {
      dateOfBirth: input.dateOfBirth === undefined ? prior.dateOfBirth : v.sensitive.dateOfBirth,
      aNumber: input.aNumber === undefined ? prior.aNumber : v.sensitive.aNumber,
    };
    const keep = <K extends "firstName" | "lastName" | "countryOfBirth" | "citizenship">(k: K) => (input[k] === undefined ? before[k] : v.data[k]);
    const data: CleanClient = { ...v.data, firstName: keep("firstName"), lastName: keep("lastName"), countryOfBirth: keep("countryOfBirth"), citizenship: keep("citizenship") };
    await db.client.update({ where: { id: before.id }, data: { ...data, ...sensitiveColumns(sensitive), updatesConsentAt } });
    const changed: string[] = (Object.keys(data) as (keyof CleanClient)[]).filter((k) => (before[k] ?? null) !== data[k]).map((k) => FIELD_LABELS[k] ?? k);
    if (prior.dateOfBirth !== sensitive.dateOfBirth) changed.push(FIELD_LABELS.dateOfBirth);
    if (prior.aNumber !== sensitive.aNumber) changed.push(FIELD_LABELS.aNumber);
    if (Boolean(before.updatesConsentAt) !== Boolean(updatesConsentAt)) changed.push(updatesConsentAt ? "update agreement recorded" : "update agreement removed");
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
    if (filters.tagId) and.push({ firmTags: { some: { tagId: filters.tagId } } });
    if (filters.view) and.push(viewWhere(filters.view, t));
    if (filters.assignee === "none") and.push({ assigneeId: null });
    else if (filters.assignee) and.push({ assigneeId: filters.assignee === "me" ? userId : filters.assignee });
    if (filters.category === "other") {
      and.push({ OR: [{ formType: null }, { formType: { notIn: (Object.keys(CASE_CATEGORIES) as (keyof typeof CASE_CATEGORIES)[]).flatMap(categoryFormVariants) } }] });
    } else if (filters.category) and.push({ formType: { in: categoryFormVariants(filters.category) } });
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
            { firmTags: { some: { tag: { name: contains } } } },
            ...(/^\d{1,3}$/.test(q) ? [{ receiptMasked: { endsWith: q } }] : []),
          ],
        });
      }
    }
    const rows = await db.trackedCase.findMany({
      where: { AND: and },
      select: {
        ...caseViewSelect,
        ...firmCaseTagsSelect,
        client: { select: { id: true, displayName: true } },
        assignee: { select: { id: true, name: true, email: true } },
        consents: { where: { withdrawnAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: SORTS[filters.sort ?? "added"],
      take: LIST_LIMIT + 1,
    });
    return {
      ctx,
      truncated: rows.length > LIST_LIMIT,
      cases: rows.slice(0, LIST_LIMIT).map(({ consents, firmTags, ...c }) => ({ ...c, category: caseCategory(c.formType), tags: flatTags(firmTags), hasConsent: consents.length > 0 })),
    };
  }

  async function getCase(userId: string, caseId: string) {
    const ctx = await ctxOf(userId);
    if (!ctx) return null;
    const c = await db.trackedCase.findFirst({
      where: { id: caseId, firmId: ctx.firm.id },
      select: {
        ...caseViewSelect,
        ...firmCaseTagsSelect,
        client: { select: { id: true, displayName: true, externalRef: true } },
        addedBy: { select: { name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
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
    if (!firmChecksAllowed(ctx.firm, t)) {
      return fail("Your free trial has ended. Choose a plan in Firm → Billing to add cases.");
    }
    if ((await db.trackedCase.count({ where: { firmId: ctx.firm.id } })) >= ctx.firm.caseLimit) {
      return fail(`Your firm's plan includes up to ${ctx.firm.caseLimit} cases.`);
    }
    const members = await activeMemberIds(ctx.firm.id);
    if (input.assigneeId && !members.has(input.assigneeId)) return fail("Choose someone on your team.", "assigneeId");
    // Who it's for: the person chosen, else the firm's default, else whoever adds it.
    const assigneeId = input.assigneeId || (ctx.firm.defaultAssigneeId && members.has(ctx.firm.defaultAssigneeId) ? ctx.firm.defaultAssigneeId : userId);
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
            assigneeId,
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

  async function activeMemberIds(firmId: string) {
    const rows = await db.firmMembership.findMany({ where: { firmId, revokedAt: null }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId));
  }

  /** Who the case is for (any member can change it); its open inbox items move with it. */
  async function setAssignee(userId: string, caseId: string, assigneeId: string | null): Promise<{ ok: true } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    const c = await db.trackedCase.findFirst({ where: { id: caseId, firmId: ctx.firm.id }, select: { id: true, assigneeId: true } });
    if (!c) return fail("Case not found.");
    if (assigneeId && !(await activeMemberIds(ctx.firm.id)).has(assigneeId)) return fail("Choose someone on your team.", "assigneeId");
    if (c.assigneeId === assigneeId) return { ok: true };
    await db.$transaction([
      db.trackedCase.update({ where: { id: c.id }, data: { assigneeId } }),
      db.firmUpdate.updateMany({ where: { caseId: c.id, state: { not: "DONE" }, assignedToId: c.assigneeId }, data: { assignedToId: assigneeId } }),
    ]);
    const to = assigneeId ? await db.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true } }) : null;
    await audit(ctx, "case.assigned", "TrackedCase", c.id, { to: to ? (to.name ?? to.email) : null });
    return { ok: true };
  }

  /** Every case as CSV (Owner/Admin): full receipt numbers, so it's recorded in the activity log. */
  async function exportCases(userId: string): Promise<{ ok: true; csv: string; count: number } | Fail> {
    const ctx = await ctxOf(userId);
    if (!ctx) return fail("You're not part of a firm workspace.");
    if (!isManager(ctx.membership.role)) return fail("Only an Owner or Admin can export cases.");
    const rows = await db.trackedCase.findMany({
      where: { firmId: ctx.firm.id },
      select: {
        receiptEncrypted: true,
        nickname: true,
        formType: true,
        statusTitleEn: true,
        lastChangeObservedAt: true,
        lastCheckedAt: true,
        createdAt: true,
        client: { select: { displayName: true, externalRef: true } },
        assignee: { select: { name: true, email: true } },
        ...firmCaseTagsSelect,
      },
      orderBy: [{ client: { displayName: "asc" } }, { createdAt: "asc" }],
    });
    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    const header = ["Client", "Client reference", "Receipt number", "Label", "Form", "Category", "Status", "Assigned to", "Tags", "Last change seen", "Last checked", "Added"];
    const lines = rows.map((r) =>
      [
        r.client?.displayName ?? "",
        r.client?.externalRef ?? "",
        revealReceipt(r),
        r.nickname ?? "",
        r.formType ?? "",
        CATEGORY_LABEL(caseCategory(r.formType)),
        r.statusTitleEn ?? "",
        r.assignee ? (r.assignee.name ?? r.assignee.email) : "",
        flatTags(r.firmTags).map((tg) => tg.name).join("; "),
        day(r.lastChangeObservedAt),
        day(r.lastCheckedAt),
        day(r.createdAt),
      ]
        .map(csvCell)
        .join(","),
    );
    await audit(ctx, "cases.exported", "Firm", ctx.firm.id, { rows: rows.length });
    return { ok: true, csv: "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n", count: rows.length };
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
    setAssignee,
    exportCases,
    counts,
  };
}

export type FirmCaseService = ReturnType<typeof createFirmCaseService>;
