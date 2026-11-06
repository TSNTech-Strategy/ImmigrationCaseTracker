import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { useTheme } from "../lib/theme";

function Shell() {
  const { c, isDark } = useTheme();

  // Tapping a "Case update" notification opens that case.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const caseId = r.notification.request.content.data?.caseId;
      if (typeof caseId === "string" && caseId) router.push(`/cases/${caseId}`);
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.heading, fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "" }} />
        <Stack.Screen name="sign-up" options={{ title: "" }} />
        <Stack.Screen name="forgot-password" options={{ title: "" }} />
        <Stack.Screen name="mfa" options={{ title: "" }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
