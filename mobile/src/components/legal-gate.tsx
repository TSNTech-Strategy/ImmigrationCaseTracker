import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Body, Button, Card, Field, H1, Screen, Small } from "./ui";
import { api, ApiError, type Me } from "../lib/api";
import { useAuth } from "../lib/auth";
import { config } from "../lib/config";
import { space, useTheme } from "../lib/theme";

/**
 * Active consent to a material change in the Terms or Privacy Policy (the
 * website's /legal/accept). Shown instead of the app until the user accepts,
 * or deletes their account.
 */
export function LegalGate({ legal }: { legal: NonNullable<Me["legal"]> }) {
  const { t, lang, setMe, signOut } = useAuth();
  const { c } = useTheme();
  const [busy, setBusy] = useState<"accept" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const open = (path: string) => WebBrowser.openBrowserAsync(`${config.siteUrl}${path}`);

  return (
    <Screen edges={["top", "bottom"]}>
      <H1>{t.legalUpdateTitle}</H1>
      <Body muted>{t.legalUpdateIntro}</Body>
      <Card>
        {legal.changes.map((change) => (
          <View key={change} style={{ flexDirection: "row", gap: space(2) }}>
            <Text style={{ color: c.accent, fontSize: 16 }}>•</Text>
            <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 22 }}>{change}</Text>
          </View>
        ))}
        {lang === "es" && <Small>{t.legalSummaryNote}</Small>}
      </Card>
      <Body>{t.legalUpdateRead(legal.updated)}</Body>
      <Button title={t.legalTerms} variant="secondary" onPress={() => open("/terms")} />
      <Button title={t.legalPrivacy} variant="secondary" onPress={() => open("/privacy")} />
      {error && <Banner tone="danger">{error}</Banner>}
      <Button
        title={t.legalAccept}
        loading={busy === "accept"}
        onPress={async () => {
          setBusy("accept");
          setError(null);
          try {
            setMe(await api<Me>("/api/v1/me/legal", { method: "POST" }));
          } catch (e) {
            setError(e instanceof ApiError ? e.message : String(e));
          }
          setBusy(null);
        }}
      />
      {!showDelete ? (
        <Text style={{ color: c.accent, fontWeight: "600", textAlign: "center" }} onPress={() => setShowDelete(true)}>
          {t.legalDecline}
        </Text>
      ) : (
        <Card style={{ borderColor: c.danger }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.danger }}>{t.deleteAccount}</Text>
          <Small muted={false}>{t.deleteConfirm}</Small>
          <Field label={t.deleteType} value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} />
          <Button
            title={t.deleteAccount}
            variant="danger"
            disabled={deleteText !== "DELETE"}
            loading={busy === "delete"}
            onPress={async () => {
              setBusy("delete");
              setError(null);
              try {
                await api("/api/v1/me", { method: "DELETE", body: { confirm: "DELETE" } });
                await signOut();
                router.replace("/welcome");
              } catch (e) {
                setError(e instanceof ApiError ? e.message : String(e));
                setBusy(null);
              }
            }}
          />
        </Card>
      )}
    </Screen>
  );
}
