import "server-only";
import { prisma } from "@/lib/db";
import { getUscisClient } from "@/lib/uscis";
import { createCaseService } from "./service";

/** The case service wired to the real database and USCIS client (mode from env). */
export function caseService() {
  return createCaseService({ db: prisma, uscis: getUscisClient() });
}

export { caseViewSelect } from "./service";
export type { CaseView, RefreshResult } from "./service";
