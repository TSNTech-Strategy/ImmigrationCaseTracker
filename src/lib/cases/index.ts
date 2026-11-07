import "server-only";
import { prisma } from "@/lib/db";
import { getUscisClient } from "@/lib/uscis";
import { createCaseService } from "./service";
import { createTagService } from "./tags";

/** The case service wired to the real database and USCIS client (mode from env). */
export function caseService() {
  return createCaseService({ db: prisma, uscis: getUscisClient() });
}

export { caseViewSelect } from "./service";
export type { CaseView, RefreshResult } from "./service";

/** Tags on personal cases, wired to the real database. */
export function tagService() {
  return createTagService({ db: prisma });
}
export { caseTagsSelect, flatTags, TAG_COLORS, TAG_LIMITS } from "./tags";
export type { TagColor, TagView, TagWithCount } from "./tags";
