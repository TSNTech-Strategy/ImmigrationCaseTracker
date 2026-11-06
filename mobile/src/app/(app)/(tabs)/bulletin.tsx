import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, H2, Screen, Small } from "../../../components/ui";
import { LargeHeader } from "../../../components/cases";
import { TwoToneTitle } from "../../../components/feature";
import { FadeInDown, stagger } from "../../../components/motion";
import { useAuth } from "../../../lib/auth";
import { BULLETIN_CATEGORIES, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "../../../lib/bulletin";
import { radius, space, useTheme } from "../../../lib/theme";

/**
 * The Visa Bulletin tab: CasePingo doesn't copy the dates. Buttons open the
 * official pages (State Department and USCIS) in the in-app browser, with a short
 * guide to reading them and the list of categories.
 */
export default function BulletinTab() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const open = (url: string) => WebBrowser.openBrowserAsync(url);
  const box = { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" as const };
  const arrow = { ios: "arrow.up.right", md: "open_in_new", fallback: "↗" } as const;

  return (
    <Screen tab>
      <LargeHeader title={t.bulletinTitle} subtitle={t.bulletinSubtitle} />

      <FadeInDown>
        <Card style={{ padding: space(5), gap: space(3), borderRadius: radius.lg + 6 }}>
          <TwoToneTitle first={t.bulletinCardFirst} second={t.bulletinCardSecond} size={26} />
          <Body muted>{t.bulletinCardBody}</Body>
          <Button title={t.openBulletin} onPress={() => open(STATE_BULLETIN_URL)} iconAfter={arrow} />
          <Button title={t.uscisWhichChart} variant="secondary" onPress={() => open(USCIS_CHARTS_URL)} iconAfter={arrow} />
          <Small>{t.bulletinOfficialNote}</Small>
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(1)}>
        <View style={{ gap: space(2) }}>
          <H2>{t.howToRead}</H2>
          <View style={box}>
            {t.howSteps.map((step, i) => (
              <View key={step.title} style={{ flexDirection: "row", gap: space(3), padding: space(4), borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.border }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: c.accent, fontWeight: "800" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{step.title}</Text>
                  <Small>{step.body}</Small>
                </View>
              </View>
            ))}
          </View>
        </View>
      </FadeInDown>

      <FadeInDown delay={stagger(2)}>
        <View style={{ gap: space(2) }}>
          <H2>{t.whatChartShows}</H2>
          <View style={box}>
            {t.chartValues.map((v, i) => (
              <View key={v.term} style={{ padding: space(4), gap: 2, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.border }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{v.term}</Text>
                <Small>{v.body}</Small>
              </View>
            ))}
          </View>
        </View>
      </FadeInDown>

      <View style={{ gap: space(2) }}>
        <H2>{t.findCategory}</H2>
        {(["family", "employment"] as const).map((kind) => (
          <View key={kind} style={box}>
            <Text
              style={{
                paddingHorizontal: space(4),
                paddingVertical: space(2.5),
                backgroundColor: c.surface2,
                color: c.muted,
                fontWeight: "700",
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {kind === "family" ? t.familyCategories : t.employmentCategories}
            </Text>
            {BULLETIN_CATEGORIES.filter((x) => x.kind === kind).map((x) => (
              <View
                key={x.key}
                style={{ flexDirection: "row", gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}
              >
                <Text style={{ width: 86, fontSize: 15, fontWeight: "700", color: c.heading }}>{x.code}</Text>
                <Text style={{ flex: 1, fontSize: 14, color: c.muted }}>{x[lang]}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Small style={{ textAlign: "center" }}>{t.bulletinDisclaimer}</Small>
    </Screen>
  );
}
