import { Redirect, Stack } from "expo-router";
import { Loading } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";

/** Signed-in area: the tabs, plus screens that open on top of them. Needs a session (and the two-factor step, if on). */
export default function AppLayout() {
  const { ready, session, needsMfa, t } = useAuth();
  const { c } = useTheme();
  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/welcome" />;
  if (needsMfa) return <Redirect href="/mfa" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.heading, fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.tabCases }} />
      <Stack.Screen name="cases/new" options={{ title: t.addCase, presentation: "modal" }} />
      <Stack.Screen name="cases/[id]" options={{ title: "" }} />
      <Stack.Screen name="guide/index" options={{ title: t.statusLibrary }} />
      <Stack.Screen name="guide/[slug]" options={{ title: "" }} />
      <Stack.Screen name="resources/[slug]" options={{ title: "" }} />
      <Stack.Screen name="civics/index" options={{ title: t.civicsTitle }} />
      <Stack.Screen name="civics/quiz" options={{ title: "" }} />
    </Stack>
  );
}
