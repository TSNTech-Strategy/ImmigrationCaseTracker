import * as SplashScreen from "expo-splash-screen";
import { useSyncExternalStore } from "react";
import { appearanceReady } from "./appearance";

/**
 * The launch screen (the CasePingo mark on the app's background) stays up
 * until the first screen is ready to show, then fades out: no spinner screen
 * and no half-loaded screen in between. Screens call launchDone() once they
 * have what they need; a time limit makes sure it never stays up too long.
 */

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });

/** Longest the launch screen waits (slow network): then the screen shows its own loading state. */
const MAX_WAIT_MS = 3500;

let requested = false;
let hidden = false;
const listeners = new Set<() => void>();

export function launchDone() {
  if (requested) return;
  requested = true;
  // The saved Light/Dark choice is a quick local read: wait for it so the first screen fades in with the right colors.
  appearanceReady.then(() => {
    hidden = true;
    SplashScreen.hideAsync().catch(() => {});
    listeners.forEach((l) => l());
  });
}

setTimeout(launchDone, MAX_WAIT_MS);

/** True once the launch screen is gone (so a screen still waiting can show its own spinner). */
export function useLaunchHidden(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hidden,
    () => hidden,
  );
}
