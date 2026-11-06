import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { config } from "./config";

/**
 * Push alerts: ask permission, get this phone's Expo push token and register
 * it with CasePingo. The server only stores the token (no device identifiers).
 */

let currentToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushResult = "registered" | "denied" | "unavailable";

export async function registerForPush(): Promise<PushResult> {
  if (Platform.OS === "web" || !Device.isDevice) return "unavailable";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("case-updates", {
      name: "Case updates",
      // eslint-disable-next-line import/namespace -- re-exported via `export *`; TypeScript checks it exists
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!status.granted) return "denied";
  const { data } = await Notifications.getExpoPushTokenAsync(config.easProjectId ? { projectId: config.easProjectId } : undefined);
  currentToken = data;
  await api("/api/v1/devices", { method: "POST", body: { token: data, platform: Platform.OS, appVersion: "1.0.0" } });
  return "registered";
}

/** On sign-out: stop pushes to this phone. */
export async function unregisterPush() {
  if (!currentToken) return;
  try {
    await api("/api/v1/devices", { method: "DELETE", body: { token: currentToken } });
  } catch {
    /* signing out anyway */
  }
  currentToken = null;
}
