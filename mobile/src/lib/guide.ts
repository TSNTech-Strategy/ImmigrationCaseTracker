import { api, type GuideEntry } from "./api";

/** The status guide, fetched once per app session (it only changes with a website release). */
type Guide = { entries: GuideEntry[]; stageCount: number };
let cache: Guide | null = null;
let pending: Promise<Guide> | null = null;

export function loadGuide(): Promise<Guide> {
  if (cache) return Promise.resolve(cache);
  pending ??= api<Guide>("/api/v1/guide")
    .then((g) => (cache = g))
    .finally(() => {
      pending = null;
    });
  return pending;
}
