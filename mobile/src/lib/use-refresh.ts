import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { AppState } from "react-native";

/**
 * Reloads a screen's data when the person comes back to the app, so a change
 * made on the website (or found by a background check) shows without pulling
 * down. Only the screen that's showing reloads, and at most once every
 * `minGapMs`, so quick app switches don't hammer the server.
 */
export function useRefreshOnForeground(refresh: () => unknown, minGapMs = 15_000) {
  const lastRun = useRef(0);
  useFocusEffect(
    useCallback(() => {
      let previous: string | null | undefined = AppState.currentState;
      const sub = AppState.addEventListener("change", (next) => {
        const cameBack = (previous === "background" || previous === "inactive") && next === "active";
        previous = next;
        if (!cameBack || Date.now() - lastRun.current < minGapMs) return;
        lastRun.current = Date.now();
        void refresh();
      });
      return () => sub.remove();
    }, [refresh, minGapMs]),
  );
}
