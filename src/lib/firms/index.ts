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
