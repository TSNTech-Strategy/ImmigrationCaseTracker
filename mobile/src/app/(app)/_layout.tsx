import { Redirect, Stack } from "expo-router";
import { Loading } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useLaunchHidden } from "../../lib/launch";
import { useTheme } from "../../lib/theme";

/** Signed-in area: the tabs, plus screens that open on top of them. Needs a session (and the two-factor step, if on). */
export default function AppLayout() {
  const { ready, session, needsMfa, t } = useAuth();
  const { c } = useTheme();
  const launchHidden = useLaunchHidden();
  if (!ready) return launchHidden ? <Loading /> : null;
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
      <Stack.Screen name="tags" options={{ title: t.tags }} />
      <Stack.Screen name="journey" options={{ title: t.journeyTitle }} />
      <Stack.Screen name="insights/[id]" options={{ title: t.insightsTitle }} />
      <Stack.Screen name="checklists/index" options={{ title: t.checklistsTitle }} />
      <Stack.Screen name="checklists/[key]" options={{ title: "" }} />
    </Stack>
  );
}
