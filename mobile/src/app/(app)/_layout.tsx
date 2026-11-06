import { Link, Redirect, Stack } from "expo-router";
import { Text } from "react-native";
import { Loading } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";

/** Signed-in area: everything here needs a session (and the two-factor step, if on). */
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
      <Stack.Screen
        name="cases/index"
        options={{
          title: t.myCases,
          headerBackVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
          headerRight: () => (
            <Link href="/settings" style={{ color: c.accent, fontWeight: "600", fontSize: 16, paddingHorizontal: 8 }} accessibilityLabel={t.settings}>
              <Text>{t.settings}</Text>
            </Link>
          ),
        }}
      />
      <Stack.Screen name="cases/new" options={{ title: t.addCase, presentation: "modal" }} />
      <Stack.Screen name="cases/[id]" options={{ title: "" }} />
      <Stack.Screen name="settings" options={{ title: t.settings }} />
    </Stack>
  );
}
