import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Body, Card, H1, Loading, Screen, Small, StatusPill } from "../../../components/ui";
import { Stepper } from "../../../components/cases";
import { ApiError, type GuideEntry } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { config } from "../../../lib/config";
import { loadGuide } from "../../../lib/guide";
import { space, useTheme } from "../../../lib/theme";

function Section({ label, children }: { label: string; children: string }) {
  return (
    <View style={{ gap: space(1) }}>
      <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{label}</Small>
      <Body>{children}</Body>
    </View>
  );
}

export default function GuideEntryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [entry, setEntry] = useState<GuideEntry | null>(null);
  const [stageCount, setStageCount] = useState(4);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuide()
      .then((g) => {
        setStageCount(g.stageCount);
        const e = g.entries.find((x) => x.slug === slug);
        if (e) setEntry(e);
        else setError(t.noMatches);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [slug, t.noMatches]);

  if (error) return <Screen><Banner tone="danger">{error}</Banner></Screen>;
  if (!entry) return <Loading />;
  const text = entry[lang];

  return (
    <Screen>
      <Stack.Screen options={{ title: t.tabGuide }} />
      <StatusPill category={entry.category} label={t.category[entry.category]} />
      <H1>{entry.heading}</H1>
      {entry.stage !== null && (
        <Stepper stage={entry.stage} total={stageCount} category={entry.category} label={t.stepOf(entry.stage + 1, stageCount, t.stages[entry.stage] ?? "")} />
      )}
      <Card style={{ gap: space(4) }}>
        <Section label={t.whatItMeans}>{text.meaning}</Section>
        <Section label={t.whatsNext}>{text.next}</Section>
        {text.todo && <Section label={t.whatYouCanDo}>{text.todo}</Section>}
      </Card>
      {entry.wordings.length > 1 && (
        <View style={{ gap: space(1) }}>
          <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{t.wordingUscis}</Small>
          {entry.wordings.map((w) => (
            <Body key={w}>“{w}”</Body>
          ))}
        </View>
      )}
      <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${config.apiUrl}${entry.path}`)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
        <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.openOnWeb} ↗</Text>
      </Pressable>
      <Small style={{ textAlign: "center" }}>
        {t.guideNote} {t.disclaimer}
      </Small>
    </Screen>
  );
}
