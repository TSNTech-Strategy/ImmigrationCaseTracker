import "server-only";
import { prisma } from "@/lib/db";
import { getUscisClient } from "@/lib/uscis";
import { createInsightsService, type InsightsService } from "./insights";

let service: InsightsService | null = null;

/** Case insights for the site, from statuses of the USCIS connection it runs on (cached per form for 10 minutes). */
export function insightsService(): InsightsService {
  service ??= createInsightsService({ db: prisma, mode: getUscisClient().mode });
  return service;
}
