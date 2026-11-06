import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Loading, Screen, Small } from "../../../components/ui";
import { LargeHeader, SearchField } from "../../../components/cases";
import { Icon } from "../../../components/icon";
import { ApiError, type GuideEntry, type StatusCategory } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { loadGuide } from "../../../lib/guide";
import { radius, space, useTheme } from "../../../lib/theme";

const GROUPS: StatusCategory[] = ["progress", "action", "done", "stop"];

export default function GuideTab() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [entries, setEntries] = useState<GuideEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadGuide()
      .then((g) => setEntries(g.entries))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, []);

  if (!entries && !error) return <Loading />;
  const q = query.trim().toLowerCase();
  const match = (e: GuideEntry) => !q || [e.heading, ...e.wordings, e[lang].meaning].some((v) => v.toLowerCase().includes(q));
  const shown = (entries ?? []).filter(match);

  return (
    <Screen tab>
      <LargeHeader title={t.guideTitle} subtitle={t.guideSubtitle} />
      {error && <Banner tone="danger">{error}</Banner>}
      <SearchField value={query} onChangeText={setQuery} placeholder={t.searchStatuses} />
      {GROUPS.map((cat) => {
        const items = shown.filter((e) => e.category === cat);
        if (items.length === 0) return null;
        return (
          <View key={cat} style={{ gap: space(2) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginTop: space(1) }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.st[cat].fg }} />
              <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "700", color: c.heading }}>
                {t.guideGroups[cat]}
              </Text>
            </View>
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
              {items.map((e, i) => (
                <Pressable
                  key={e.slug}
                  accessibilityRole="button"
                  accessibilityLabel={e.heading}
                  onPress={() => router.push(`/guide/${e.slug}`)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space(3),
                    paddingHorizontal: space(4),
                    paddingVertical: space(3.5),
                    backgroundColor: pressed ? c.surface2 : c.surface,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>{e.heading}</Text>
                    <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }} numberOfLines={2}>
                      {e[lang].meaning}
                    </Text>
                  </View>
                  <Icon ios="chevron.right" md="chevron_right" size={14} color={c.muted} fallback="›" />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
      {entries && shown.length === 0 && <Small style={{ textAlign: "center" }}>{t.noMatches}</Small>}
      <Small style={{ textAlign: "center" }}>
        {t.guideNote} {t.disclaimer}
      </Small>
    </Screen>
  );
}
