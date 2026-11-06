import { router } from "expo-router";
import { View } from "react-native";
import { Body, Button, Logo, Screen, Small } from "../components/ui";
import { FeatureCard, LangSwitch, TwoToneTitle, type Glyph, type Tint } from "../components/feature";
import { FadeInDown, stagger, useSpotlight } from "../components/motion";
import { useAuth } from "../lib/auth";
import { space } from "../lib/theme";

const FEATURES: { key: "receipt" | "alerts" | "guide" | "privacy"; glyph: Glyph; tint: Tint }[] = [
  { key: "receipt", glyph: { ios: "plus", md: "add", fallback: "+" }, tint: "blue" },
  { key: "alerts", glyph: { ios: "bell", md: "notifications", fallback: "!" }, tint: "green" },
  { key: "guide", glyph: { ios: "book", md: "menu_book", fallback: "?" }, tint: "amber" },
  { key: "privacy", glyph: { ios: "lock.shield", md: "shield_lock", fallback: "•" }, tint: "navy" },
];

/** First screen before sign-in: what CasePingo does, in English or Spanish. */
export default function Welcome() {
  const { t, lang, setGuestLang } = useAuth();
  // After the cards drop in, a highlight walks down them, one every ~3 seconds.
  const spot = useSpotlight(FEATURES.length);
  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ gap: space(6), paddingTop: space(2) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) }}>
          <Logo size={32} />
          <LangSwitch value={lang} onChange={setGuestLang} />
        </View>

        <FadeInDown style={{ gap: space(3) }}>
          <TwoToneTitle first={t.welcomeFirst} second={t.welcomeSecond} />
          <Body muted>{t.welcomeBody}</Body>
        </FadeInDown>

        <View style={{ gap: space(3) }}>
          {FEATURES.map((f, i) => (
            <FadeInDown key={f.key} delay={stagger(i, 110, 160)}>
              <FeatureCard glyph={f.glyph} tint={f.tint} title={t.features[f.key].title} text={t.features[f.key].text} drop={stagger(i, 110, 300)} active={spot === i} />
            </FadeInDown>
          ))}
        </View>

        <FadeInDown delay={stagger(4, 110, 160)} style={{ gap: space(3) }}>
          <Button title={t.createAccount} onPress={() => router.push("/sign-up")} iconAfter={{ ios: "arrow.right", md: "arrow_forward", fallback: "→" }} />
          <Button title={t.signIn} variant="secondary" onPress={() => router.push("/sign-in")} />
        </FadeInDown>
        <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
      </View>
    </Screen>
  );
}
