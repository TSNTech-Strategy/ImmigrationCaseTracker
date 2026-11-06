import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import type { CivicsResponse, CivicsVersion } from "./civics-quiz";

export * from "./civics-quiz";

/**
 * Civics test practice: USCIS's official questions from GET /api/v1/civics
 * (fetched once per app session), and the settings saved on this device. The
 * quiz logic is in ./civics-quiz.
 */

let cache: CivicsResponse | null = null;
let pending: Promise<CivicsResponse> | null = null;

export function loadCivics(): Promise<CivicsResponse> {
  if (cache) return Promise.resolve(cache);
  pending ??= api<CivicsResponse>("/api/v1/civics")
    .then((r) => (cache = r))
    .finally(() => {
      pending = null;
    });
  return pending;
}

// ---- Settings, remembered on this device ----

const PREFS = "casepingo.civics";
export type CivicsPrefs = { version: CivicsVersion; senior: boolean };

export async function loadCivicsPrefs(): Promise<Partial<CivicsPrefs>> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(PREFS)) ?? "{}");
    return { version: v.version === "2008" || v.version === "2025" ? v.version : undefined, senior: v.senior === true };
  } catch {
    return {};
  }
}

export function saveCivicsPrefs(p: CivicsPrefs) {
  AsyncStorage.setItem(PREFS, JSON.stringify(p)).catch(() => {});
}
