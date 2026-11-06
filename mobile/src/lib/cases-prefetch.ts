import { api, type CaseSummary } from "./api";

/**
 * Starts loading the case list while the app is still starting (alongside the
 * profile), so My cases can show right away when the launch screen fades.
 */

export type CasesResponse = { cases: CaseSummary[]; stageCount?: number };

let pending: { at: number; promise: Promise<CasesResponse> } | null = null;

export function prefetchCases() {
  const promise = api<CasesResponse>("/api/v1/cases");
  promise.catch(() => {});
  pending = { at: Date.now(), promise };
}

/** The prefetched list, once, if it's still fresh; otherwise null (load it normally). */
export function takePrefetchedCases(): Promise<CasesResponse> | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < 20_000 ? p.promise : null;
}
