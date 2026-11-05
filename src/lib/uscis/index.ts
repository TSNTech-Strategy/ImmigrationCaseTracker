import "server-only";
import { assertRealUscisInProduction, getUscisConfig, isMockUscis } from "./config";
import { fetchCaseStatus, type CaseStatusResult } from "./client";
import { mockFetchCaseStatus } from "./mock";

export * from "./errors";
export type { CaseStatusSnapshot, ReportedDate } from "./normalize";
export type { CaseStatusResult } from "./client";
export { isMockUscis, isUscisConfigured, assertRealUscisInProduction } from "./config";

export type UscisClient = {
  mode: "mock" | "sandbox" | "production";
  getCaseStatus(receipt: string): Promise<CaseStatusResult>;
};

/** The one entry point app code uses. Mock vs real is decided by env only. */
export function getUscisClient(): UscisClient {
  assertRealUscisInProduction();
  if (isMockUscis()) return { mode: "mock", getCaseStatus: mockFetchCaseStatus };
  const config = getUscisConfig();
  return { mode: config.env, getCaseStatus: (receipt) => fetchCaseStatus(config, receipt) };
}
