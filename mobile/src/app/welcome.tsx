import { router } from "expo-router";
import { View } from "react-native";
import { Body, Button, Card, H1, Logo, Pill, Screen, Small } from "../components/ui";
import { useAuth } from "../lib/auth";
import { space, useTheme } from "../lib/theme";

export default function Welcome() {
  const { t } = useAuth();
  const { c } = useTheme();
  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingTop: space(6), gap: space(6) }}>
        <Logo size={40} />
        <View style={{ gap: space(3) }}>
          <Small style={{ color: c.brandRed, fontWeight: "700" }}>{t.tagline}</Small>
          <H1 style={{ fontSize: 32, lineHeight: 38 }}>{t.welcomeTitle}</H1>
          <Body muted>{t.welcomeBody}</Body>
        </View>
        {/* Illustrative example of a case card */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Body style={{ fontWeight: "700" }}>Mom&apos;s I-130</Body>
            <Pill text="Approved" tone="success" />
          </View>
          <Small>I-130 · EAC*******402</Small>
          <Small>{t.example}</Small>
        </Card>
        <View style={{ gap: space(3) }}>
          <Button title={t.createAccount} onPress={() => router.push("/sign-up")} />
          <Button title={t.signIn} variant="secondary" onPress={() => router.push("/sign-in")} />
        </View>
        <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
      </View>
    </Screen>
  );
}
