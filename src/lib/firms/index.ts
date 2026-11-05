import "server-only";
import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { getSiteUrl } from "@/lib/supabase/env";
import { caseService } from "@/lib/cases";
import { createFirmCaseService } from "./cases";
import { createFirmService } from "./service";

export function firmService() {
  return createFirmService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() });
}
export { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "./service";

/** Firm clients and cases, wired to the real database and USCIS client. */
export function firmCaseService() {
  return createFirmCaseService({ db: prisma, cases: caseService() });
}
