import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Which status changes this phone has already shown ("New" badges).
 * Kept on the device only. The first time, everything already there counts
 * as seen, so a fresh install doesn't mark every case as new.
 */
const KEY = "casepingo:seen-changes";
type Seen = Record<string, string>;

async function read(): Promise<Seen | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Seen) : null;
  } catch {
    return null;
  }
}

async function write(seen: Seen) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable: badges may simply show again.
  }
}

/** The seen map, creating the baseline from these cases on first use. */
export async function seenChanges(cases: { id: string; lastChangeObservedAt: string | null }[]): Promise<Seen> {
  const seen = await read();
  if (seen) return seen;
  const baseline: Seen = {};
  for (const c of cases) if (c.lastChangeObservedAt) baseline[c.id] = c.lastChangeObservedAt;
  await write(baseline);
  return baseline;
}

export async function markSeen(caseId: string, changedAt: string | null) {
  if (!changedAt) return;
  const seen = (await read()) ?? {};
  if (seen[caseId] === changedAt) return;
  seen[caseId] = changedAt;
  await write(seen);
}

export const hasNewChange = (seen: Seen | null, c: { id: string; lastChangeObservedAt: string | null }) =>
  Boolean(seen && c.lastChangeObservedAt && (!seen[c.id] || seen[c.id] < c.lastChangeObservedAt));
