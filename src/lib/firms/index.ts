import "server-only";
import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { getSiteUrl } from "@/lib/supabase/env";
import { createFirmService } from "./service";

export function firmService() {
  return createFirmService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() });
}
export { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "./service";
