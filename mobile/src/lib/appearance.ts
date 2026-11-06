import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance, Platform } from "react-native";

/** Light or dark: follow the phone's setting (the default), or always one of them. Kept on this device. */
export type AppearanceChoice = "auto" | "light" | "dark";
export const APPEARANCE_CHOICES: readonly AppearanceChoice[] = ["auto", "light", "dark"];

const KEY = "casepingo:appearance";
let choice: AppearanceChoice = "auto";
const listeners = new Set<() => void>();

function isChoice(v: unknown): v is AppearanceChoice {
  return v === "auto" || v === "light" || v === "dark";
}

function apply(next: AppearanceChoice) {
  choice = next;
  // On phones the system parts follow as well: the tab bar, alerts, the keyboard.
  // ("auto" removes the override.) The web preview has no such switch; the theme store covers it.
  if (Platform.OS !== "web") {
    try {
      Appearance.setColorScheme(next);
    } catch {
      // Older native code without the override: the app's own colors still follow the choice.
    }
  }
  listeners.forEach((l) => l());
}

/**
 * Settles once the saved choice has been read (a quick local read), so the launch
 * screen can wait for it and the first screen appears in the right colors. Never rejects.
 */
export const appearanceReady: Promise<void> = Promise.race([
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (isChoice(v) && v !== "auto") apply(v);
    })
    .catch(() => {}),
  new Promise<void>((resolve) => setTimeout(resolve, 800)),
]);

export function setAppearance(next: AppearanceChoice) {
  if (next === choice) return;
  apply(next);
  AsyncStorage.setItem(KEY, next).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppearance(): AppearanceChoice {
  return useSyncExternalStore(subscribe, () => choice, () => choice);
}
