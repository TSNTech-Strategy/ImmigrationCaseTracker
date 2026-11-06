import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { Banner, Body, Button, Card, Choice, Field, H2, Screen, Small } from "../../../components/ui";
import { LargeHeader } from "../../../components/cases";
import { api, ApiError, type Me } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { config } from "../../../lib/config";
import { trialDaysLeft } from "../../../lib/i18n";
import { registerForPush } from "../../../lib/push";
import { useRefreshOnForeground } from "../../../lib/use-refresh";
import { space, useTheme } from "../../../lib/theme";

export default function Settings() {
  const { t, me, setMe, signOut, refreshMe } = useAuth();
  const { c } = useTheme();
  const [name, setName] = useState(me?.name ?? "");
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setName(me?.name ?? ""), [me?.name]);
  useRefreshOnForeground(refreshMe);
  if (!me) return null;

  async function patch(body: Partial<{ name: string; locale: "en" | "es"; emailOnChange: boolean; pushOnChange: boolean }>) {
    try {
      setMe(await api<Me>("/api/v1/me", { method: "PATCH", body }));
      setNote({ tone: "success", text: t.saved });
    } catch (e) {
      setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
    }
  }

  const days = trialDaysLeft(me.plan.trialEndsAt);
  return (
    <Screen tab>
      <LargeHeader title={t.settings} />
      {note && <Banner tone={note.tone}>{note.text}</Banner>}

      <H2>{t.profile}</H2>
      <Card>
        <Small>{me.email}</Small>
        <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" />
        <Button title={t.save} variant="secondary" disabled={!name.trim() || name === me.name} onPress={() => patch({ name: name.trim() })} />
      </Card>

      <H2>{t.language}</H2>
      <View style={{ gap: space(2) }}>
        <Choice selected={me.locale === "en"} onPress={() => patch({ locale: "en" })} title="English" />
        <Choice selected={me.locale === "es"} onPress={() => patch({ locale: "es" })} title="Español" />
      </View>

      <H2>{t.alerts}</H2>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Body>{t.emailAlerts}</Body>
          <Switch value={me.alerts.email} onValueChange={(v) => patch({ emailOnChange: v })} trackColor={{ true: c.accent, false: c.border }} thumbColor="#FFFFFF" accessibilityLabel={t.emailAlerts} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Body>{t.pushAlerts}</Body>
          <Switch
            value={me.alerts.push}
            accessibilityLabel={t.pushAlerts}
            trackColor={{ true: c.accent, false: c.border }} thumbColor="#FFFFFF"
            onValueChange={async (v) => {
              if (v && Platform.OS !== "web") {
                const r = await registerForPush();
                if (r === "denied") {
                  setNote({ tone: "danger", text: t.pushDenied });
                  return;
                }
              }
              await patch({ pushOnChange: v });
            }}
          />
        </View>
        {!me.plan.alerts && <Small>{t.freePlan}</Small>}
        <Small>{t.alertsNote}</Small>
      </Card>

      <H2>{t.plan}</H2>
      <Card>
        <Body style={{ fontWeight: "700" }}>{me.plan.name}</Body>
        <Small>{days > 0 ? t.trialLeft(days) : me.plan.id === "FREE" ? t.freePlan : t.premiumPlan}</Small>
      </Card>

      <H2>{t.legal}</H2>
      <Card>
        <Text style={{ color: c.accent, fontWeight: "600", paddingVertical: space(1) }} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/privacy`)}>
          {t.privacy}
        </Text>
        <Text style={{ color: c.accent, fontWeight: "600", paddingVertical: space(1) }} onPress={() => WebBrowser.openBrowserAsync(`${config.siteUrl}/terms`)}>
          {t.terms}
        </Text>
        <Small>{t.disclaimer}</Small>
      </Card>

      <Button
        title={t.signOut}
        variant="secondary"
        loading={busy === "signout"}
        onPress={async () => {
          setBusy("signout");
          await signOut();
          router.replace("/welcome");
        }}
      />

      <H2 style={{ color: c.danger }}>{t.deleteAccount}</H2>
      <Card style={{ borderColor: c.danger }}>
        <Small muted={false}>{t.deleteConfirm}</Small>
        <Field label={t.deleteType} value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} />
        <Button
          title={t.deleteAccount}
          variant="danger"
          disabled={deleteText !== "DELETE"}
          loading={busy === "delete"}
          onPress={async () => {
            setBusy("delete");
            try {
              await api("/api/v1/me", { method: "DELETE", body: { confirm: "DELETE" } });
              await signOut();
              router.replace("/welcome");
            } catch (e) {
              setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
              setBusy(null);
            }
          }}
        />
      </Card>
      <Small style={{ textAlign: "center" }}>{t.version(Constants.expoConfig?.version ?? "1.0.0")}</Small>
    </Screen>
  );
}
