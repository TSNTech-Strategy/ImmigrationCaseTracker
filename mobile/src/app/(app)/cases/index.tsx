import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Banner, Body, Button, Card, Pill, Screen, Small } from "../../../components/ui";
import { api, ApiError, type CaseSummary } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDate, trialDaysLeft } from "../../../lib/i18n";
import { font, space, useTheme } from "../../../lib/theme";

export default function Cases() {
  const { t, lang, me, refreshMe } = useAuth();
  const { c } = useTheme();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ cases: CaseSummary[] }>("/api/v1/cases");
      setCases(r.cases);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
    refreshMe();
  }, [refreshMe]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const days = trialDaysLeft(me?.plan.trialEndsAt ?? null);
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {days > 0 ? <Banner tone="info">{t.trialLeft(days)}</Banner> : me?.plan.id === "FREE" ? <Banner tone="plain">{t.freePlan}</Banner> : null}
      {error && <Banner tone="danger">{error}</Banner>}
      <Button title={t.addCase} onPress={() => router.push("/cases/new")} />
      {cases && cases.length === 0 && (
        <Card style={{ alignItems: "center", paddingVertical: space(8) }}>
          <Body style={{ fontWeight: "700", textAlign: "center" }}>{t.noCases}</Body>
          <Small style={{ textAlign: "center" }}>{t.noCasesHint}</Small>
        </Card>
      )}
      {cases?.map((cs) => {
        const status = (lang === "es" ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn ?? t.notChecked;
        const paused = cs.pausedReason === "plan_limit";
        return (
          <Card key={cs.id} onPress={() => router.push(`/cases/${cs.id}`)} label={`${cs.nickname ?? cs.receiptMasked}: ${status}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space(2) }}>
              <Body style={{ fontWeight: "700", flex: 1 }}>{cs.nickname ?? cs.receiptMasked}</Body>
              {/approv/i.test(cs.statusTitleEn ?? "") && <Pill text={lang === "es" ? "Aprobado" : "Approved"} tone="success" />}
            </View>
            <Small style={font.mono}>
              {cs.formType ? `${cs.formType} · ` : ""}
              {cs.receiptMasked}
            </Small>
            <Body>{status}</Body>
            <Small>
              {t.lastChecked}: {formatDate(cs.lastCheckedAt, lang, t.never)}
            </Small>
            {paused && <Small style={{ color: c.danger, fontWeight: "600" }}>{t.pausedPlan}</Small>}
          </Card>
        );
      })}
      <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
    </Screen>
  );
}
