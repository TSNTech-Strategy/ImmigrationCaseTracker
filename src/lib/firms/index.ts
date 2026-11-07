import { createFirmDataService } from "./data";
import { createFirmSyncService } from "./sync";
import { createFirmTeamService } from "./team";
import { createFirmReportService } from "./reports";
import { createDocumentRequestService } from "./requests";
import { createFirmBrandingService } from "./branding";
import { createFirmDocumentService } from "./documents";
import { getFileStore } from "@/lib/storage/file-store";
import { createFirmMatterService } from "./matters";
import { createFirmTaskService } from "./tasks";
import { createFirmDashboardService } from "./dashboard";
import { createFirmAlertService } from "./alerts";
import "server-only";
import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { getSiteUrl } from "@/lib/supabase/env";
import { caseService } from "@/lib/cases";
import { createFirmAuditService } from "./audit";
import { createFirmCaseService } from "./cases";
import { createFirmImportService } from "./import";
import { createFirmService } from "./service";
import { createFirmTagService } from "./tags";
import { createFirmUpdateService } from "./updates";

export function firmService() {
  return createFirmService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() });
}
export { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "./service";

/** Firm clients and cases, wired to the real database and USCIS client. */
export function firmCaseService() {
  return createFirmCaseService({ db: prisma, cases: caseService() });
}

/** CSV import for firm cases. */
export function firmImportService() {
  return createFirmImportService({ db: prisma });
}

/** The firm activity log (Owners and Admins). */
export function firmAuditService() {
  return createFirmAuditService({ db: prisma });
}

/** Tags the firm's team shares on its cases. */
export function firmTagService() {
  return createFirmTagService({ db: prisma });
}

/** The status desk: Updates inbox, client updates and client status page links. */
export function firmUpdateService() {
  return createFirmUpdateService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() });
}

/** Stuck-case alerts and case deadlines. */
export function firmAlertService() {
  return createFirmAlertService({ db: prisma });
}

/** The firm dashboard (numbers from the firm's own cases). */
export function firmDashboardService() {
  return createFirmDashboardService({ db: prisma });
}

/** Team tasks, comments and the task calendar. */
export function firmTaskService() {
  return createFirmTaskService({ db: prisma });
}

/** Matters: groups of related cases. */
export function firmMatterService() {
  return createFirmMatterService({ db: prisma });
}

/** Firm documents (encrypted file storage). */
export function firmDocumentService() {
  return createFirmDocumentService({ db: prisma, store: getFileStore() });
}

/** Document requests to clients (checklists, upload links, review, reminders). */
export function documentRequestService() {
  return createDocumentRequestService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl(), docs: firmDocumentService() });
}

/** The firm's logo for the client portal, upload page and client emails. */
export function firmBrandingService() {
  return createFirmBrandingService({ db: prisma, store: getFileStore() });
}

/** Dashboard reports as CSV. */
export function firmReportService() {
  return createFirmReportService({ db: prisma });
}

/** Team titles, last active, and each member's own notification settings. */
export function firmTeamService() {
  return createFirmTeamService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() });
}

/** Sync: the firm's USCIS check schedule, recent checks and problems. */
export function firmSyncService() {
  return createFirmSyncService({ db: prisma });
}

/** Legal and data: export everything, delete the workspace. */
export function firmDataService() {
  return createFirmDataService({ db: prisma, store: getFileStore() });
}
