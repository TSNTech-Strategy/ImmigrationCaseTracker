import { useSyncExternalStore } from "react";

/**
 * How many cases have changes this phone hasn't shown yet: the badge on the
 * Updates tab. My cases and Updates set it after they load.
 */
let unread = 0;
const listeners = new Set<() => void>();

export function setUnreadUpdates(n: number) {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
}

export function useUnreadUpdates(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => unread,
    () => unread,
  );
}
