import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { strings, type Lang } from "./i18n";
import { hearingDate, reminderTimes } from "./court-dates";

export { autoSlash, daysUntil, formatANumber, hearingDate, maskANumber, parseTime, parseUsDate, reminderTimes, validANumber } from "./court-dates";

/**
 * Immigration court cases, saved on this phone only (the keychain / Android
 * Keystore; the web preview, used for testing, keeps them in localStorage).
 * CasePingo's servers never receive A-Numbers, and CasePingo never looks up
 * court cases: the person checks EOIR's own site and types the next hearing
 * here to get reminders before it.
 */

export type CourtCase = {
  id: string;
  /** 9 digits, no "A" (an 8-digit A-Number starts with 0). */
  aNumber: string;
  court: string | null;
  /** Local date and time of the next hearing, "YYYY-MM-DDTHH:MM", or null. */
  hearingAt: string | null;
  /** Scheduled reminder notifications, so they can be replaced or cancelled. */
  reminderIds: string[];
  createdAt: string;
};

const KEY = "casepingo.court-cases";

async function read(): Promise<string | null> {
  if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}
async function write(value: string) {
  if (Platform.OS === "web") localStorage.setItem(KEY, value);
  else await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function loadCourtCases(): Promise<CourtCase[]> {
  try {
    const raw = await read();
    const list = raw ? (JSON.parse(raw) as CourtCase[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ---- Saving, with reminders ---------------------------------------------------------------

async function cancelReminders(c: CourtCase) {
  if (Platform.OS === "web") return;
  await Promise.all(c.reminderIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** Schedules this hearing's reminders. Returns their ids, or null when notifications aren't allowed. */
async function scheduleReminders(c: CourtCase, lang: Lang): Promise<string[] | null> {
  if (Platform.OS === "web" || !c.hearingAt) return [];
  const perm = await Notifications.getPermissionsAsync();
  const ok = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!ok) return null;
  const t = strings(lang);
  const h = hearingDate(c.hearingAt);
  const when = h.toLocaleString(lang === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const ids: string[] = [];
  for (const r of reminderTimes(c.hearingAt)) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        // No A-Number on the lock screen.
        content: { title: t.courtReminderTitle, body: t.courtReminderBody(r.kind, when, c.court), data: { court: c.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.when, ...(Platform.OS === "android" ? { channelId: "case-updates" } : {}) },
      }),
    );
  }
  return ids;
}

export type SaveResult = { list: CourtCase[]; reminders: "on" | "off" | "none" };

/** Adds or updates a court case and (re)schedules its reminders. */
export async function saveCourtCase(input: Omit<CourtCase, "reminderIds" | "createdAt" | "id"> & { id?: string }, lang: Lang): Promise<SaveResult> {
  const list = await loadCourtCases();
  const old = input.id ? list.find((x) => x.id === input.id) : undefined;
  if (old) await cancelReminders(old);
  const c: CourtCase = {
    id: old?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    aNumber: input.aNumber,
    court: input.court?.trim() || null,
    hearingAt: input.hearingAt,
    reminderIds: [],
    createdAt: old?.createdAt ?? new Date().toISOString(),
  };
  const ids = await scheduleReminders(c, lang);
  c.reminderIds = ids ?? [];
  const next = old ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c];
  await write(JSON.stringify(next));
  return { list: next, reminders: !c.hearingAt ? "none" : ids === null ? "off" : "on" };
}

export async function removeCourtCase(id: string): Promise<CourtCase[]> {
  const list = await loadCourtCases();
  const gone = list.find((x) => x.id === id);
  if (gone) await cancelReminders(gone);
  const next = list.filter((x) => x.id !== id);
  await write(JSON.stringify(next));
  return next;
}
