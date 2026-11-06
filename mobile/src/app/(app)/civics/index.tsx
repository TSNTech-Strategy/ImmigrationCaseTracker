import { router, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Check, Choice, H2, Loading, Screen, Small } from "../../../components/ui";
import { IconTile } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { loadCivics, loadCivicsPrefs, saveCivicsPrefs, type CivicsResponse, type CivicsVersion } from "../../../lib/civics";
import { radius, space, useTheme } from "../../../lib/theme";

/** Civics test practice: pick the test (2025 or 2008, 65/20), then a mock test or one section. */
export default function CivicsHome() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<CivicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<CivicsVersion | null>(null);
  const [senior, setSenior] = useState(false);

  useEffect(() => {
    Promise.all([loadCivics(), loadCivicsPrefs()])
      .then(([d, prefs]) => {
        setData(d);
        setVersion(prefs.version ?? d.defaultVersion);
        setSenior(Boolean(prefs.senior));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, []);

  if (!data && !error) return <Loading />;
  const test = data?.versions.find((v) => v.version === version) ?? data?.versions[0];
  const rules = test ? (senior ? test.rules.senior : test.rules.standard) : null;
  const set = (v: CivicsVersion, s: boolean) => {
    setVersion(v);
    setSenior(s);
    saveCivicsPrefs({ version: v, senior: s });
  };
  const start = (mode: string) => router.push({ pathname: "/civics/quiz", params: { v: test!.version, mode, senior: senior ? "1" : "0" } });

  return (
    <Screen>
      <Stack.Screen options={{ title: t.civicsTitle }} />
      {error && <Banner tone="danger">{error}</Banner>}
      {data && test && rules && (
        <>
          <View style={{ gap: space(3) }}>
            <IconTile glyph={{ ios: "graduationcap", md: "school", fallback: "🎓" }} tint="navy" size={52} />
            <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>
              {t.civicsTitle}
            </Text>
            <Body muted>
              {t.civicsSummary} {t.civicsIntro}
            </Body>
          </View>

          <View style={{ gap: space(2.5) }}>
            <H2>{t.civicsWhich}</H2>
            {data.versions.map((v) => (
              <Choice key={v.version} selected={v.version === test.version} onPress={() => set(v.version, senior)} title={`${v.title[lang]} · ${t.civicsQuestions(v.total)}`} body={v.who[lang]} />
            ))}
            <View style={{ paddingTop: space(1) }}>
              <Check checked={senior} onChange={(s) => set(test.version, s)} label={t.civicsSenior} />
            </View>
          </View>

          <Card style={{ padding: space(4), gap: space(3) }}>
            <H2>{t.civicsMock}</H2>
            <Body muted>{senior ? data.text.senior[lang] : test.format[lang]}</Body>
            <Button title={t.civicsStartMock} onPress={() => start("mock")} iconAfter={{ ios: "arrow.right", md: "arrow_forward", fallback: "→" }} />
          </Card>

          <View style={{ gap: space(2.5) }}>
            <H2>{t.civicsBySection}</H2>
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
              {test.sections.map((s, i) => {
                const count = test.questions.filter((q) => q.section === s.key && (!senior || q.star)).length;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.title[lang]}, ${t.civicsSectionCount(count)}`}
                    accessibilityState={{ disabled: count === 0 }}
                    disabled={count === 0}
                    onPress={() => start(s.key)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space(3),
                      paddingHorizontal: space(4),
                      paddingVertical: space(3.5),
                      opacity: count === 0 ? 0.5 : 1,
                      backgroundColor: pressed ? c.surface2 : c.surface,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.group[lang]}</Text>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{s.title[lang]}</Text>
                      <Text style={{ fontSize: 13, color: c.muted }}>{t.civicsSectionCount(count)}</Text>
                    </View>
                    {count > 0 && <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space(2) }}>
            <Small>
              {data.text.spoken[lang]} {t.civicsEnglish}
            </Small>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(4) }}>
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(test.listUrl)}>
                <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.civicsOfficialList} ↗</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(data.links.testUpdates)}>
                <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.civicsTestUpdates} ↗</Text>
              </Pressable>
            </View>
            <Small>{data.text.disclaimer[lang]}</Small>
          </View>
        </>
      )}
    </Screen>
  );
}
