import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Loading, Screen, Small } from "../../../components/ui";
import { FadeInDown, stagger } from "../../../components/motion";
import { Icon } from "../../../components/icon";
import { api, ApiError, type ChecklistsResponse } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { radius, space, useTheme } from "../../../lib/theme";

/** Document checklists: one card per case type with this person's progress. */
export default function Checklists() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<ChecklistsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<ChecklistsResponse>("/api/v1/checklists"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data && !error) return <Loading />;
  return (
    <Screen>
      {error && <Banner tone="danger">{error}</Banner>}
      <Text style={{ fontSize: 15, color: c.muted, lineHeight: 21 }}>{t.checklistsSub}</Text>
      {data?.checklists.map((cl, i) => {
        const pct = cl.required ? cl.requiredDone / cl.required : 0;
        return (
          <FadeInDown key={cl.key} delay={stagger(i, 40)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cl.title[lang]}, Form ${cl.form}. ${t.checklistReady(cl.requiredDone, cl.required)}`}
              onPress={() => router.push(`/checklists/${cl.key}`)}
              style={({ pressed }) => ({ padding: space(4), gap: space(2), borderRadius: radius.lg + 2, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 6, backgroundColor: c.accentSoft }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: c.accent }}>{cl.form}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: c.heading }}>{cl.title[lang]}</Text>
                <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
              </View>
              <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{cl.summary[lang]}</Text>
              {cl.done > 0 ? (
                <View style={{ gap: 6 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: "hidden" }}>
                    <View style={{ width: `${Math.max(2, pct * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.st.done.fg }} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{t.checklistReady(cl.requiredDone, cl.required)}</Text>
                </View>
              ) : (
                <Small style={{ fontSize: 13 }}>{t.checklistCount(cl.required, cl.total - cl.required)}</Small>
              )}
            </Pressable>
          </FadeInDown>
        );
      })}
    </Screen>
  );
}
