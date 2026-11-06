import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { Banner, Body, Button, Card, H1, H2, Loading, Row, Screen, Small } from "../../../components/ui";
import { api, ApiError, type CaseDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDate } from "../../../lib/i18n";
import { font, space, useTheme } from "../../../lib/theme";

function confirm(message: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(message) ?? true);
  return new Promise((resolve) =>
    Alert.alert(message, undefined, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, me } = useAuth();
  const { c } = useTheme();
  const [cs, setCs] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<"check" | "remove" | "switch" | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ case: CaseDetail }>(`/api/v1/cases/${id}`);
      setCs(r.case);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (error && !cs) return <Screen><Banner tone="danger">{error}</Banner></Screen>;
  if (!cs) return <Loading />;

  const es = lang === "es";
  const title = (es ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn ?? t.notChecked;
  const desc = (es ? cs.statusDescriptionEs : cs.statusDescriptionEn) ?? cs.statusDescriptionEn;
  const paused = cs.pausedReason === "plan_limit";
  const free = me?.plan.id === "FREE";

  async function checkNow() {
    setBusy("check");
    setNote(null);
    try {
      const r = await api<{ message: string }>(`/api/v1/cases/${id}/refresh`, { method: "POST" });
      setNote({ tone: "success", text: r.message });
      await load();
    } catch (e) {
      setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: cs.nickname ?? cs.receiptMasked }} />
      <View style={{ gap: space(1) }}>
        <H1>{cs.nickname ?? cs.receiptMasked}</H1>
        <Small style={font.mono}>
          {cs.formType ? `${cs.formType} · ` : ""}
          {cs.receiptMasked}
        </Small>
      </View>

      {paused && (
        <Card style={{ borderColor: c.danger }}>
          <Body style={{ fontWeight: "700" }}>{t.pausedPlan}</Body>
          <Button
            title={t.checkInstead}
            variant="secondary"
            loading={busy === "switch"}
            onPress={async () => {
              setBusy("switch");
              try {
                await api(`/api/v1/cases/${id}/check-instead`, { method: "POST" });
                await load();
              } finally {
                setBusy(null);
              }
            }}
          />
        </Card>
      )}

      <Card>
        <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600" }}>{t.currentStatus}</Small>
        <H2 style={{ fontSize: 22 }}>{title}</H2>
        {desc && <Body>{desc.replace(/<[^>]+>/g, "")}</Body>}
        <View style={{ gap: space(3), marginTop: space(2) }}>
          <Row label={t.lastChecked} value={formatDate(cs.lastCheckedAt, lang, t.never)} />
          <Row label={t.lastChange} value={formatDate(cs.lastChangeObservedAt, lang, t.noneYet)} />
        </View>
        {!paused && <Button title={busy === "check" ? t.checking : t.checkNow} onPress={checkNow} loading={busy === "check"} />}
        {note && <Banner tone={note.tone}>{note.text}</Banner>}
        <Small>{free ? t.freePlan : t.premiumPlan} {t.uscisSource}</Small>
      </Card>

      <H2>{t.changesSeen}</H2>
      {cs.events.length === 0 ? (
        <Small>{t.nothingYet}</Small>
      ) : (
        <Card>
          {cs.events.map((e) => (
            <View key={e.id} style={{ gap: 2, paddingVertical: space(1) }}>
              <Body style={{ fontWeight: "600" }}>{(es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn}</Body>
              <Small>{formatDate(e.firstObservedAt, lang, "")}</Small>
            </View>
          ))}
        </Card>
      )}

      {cs.uscisHistory && cs.uscisHistory.length > 0 && (
        <>
          <H2>{t.uscisHistory}</H2>
          <Card>
            {cs.uscisHistory.map((h, i) => (
              <View key={i} style={{ gap: 2, paddingVertical: space(1) }}>
                <Body>{(es ? h.textEs : h.textEn) ?? h.textEn ?? "—"}</Body>
                {h.date?.raw && <Small>{h.date.raw}</Small>}
              </View>
            ))}
          </Card>
        </>
      )}

      <Button
        title={t.remove}
        variant="danger"
        loading={busy === "remove"}
        onPress={async () => {
          if (!(await confirm(t.removeConfirm, t.remove, t.cancel))) return;
          setBusy("remove");
          try {
            await api(`/api/v1/cases/${id}`, { method: "DELETE" });
            router.replace("/cases");
          } finally {
            setBusy(null);
          }
        }}
      />
      <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
    </Screen>
  );
}
