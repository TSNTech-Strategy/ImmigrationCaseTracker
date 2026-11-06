import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Screen, Small, StatusPill } from "../../../components/ui";
import { FlagStripe, StarBurst, StarsMark, dismissApproval, dismissedApprovals, takeUnplayed } from "../../../components/celebration";
import { api, ApiError, type CaseSummary } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDate, trialDaysLeft } from "../../../lib/i18n";
import { font, radius, space, useTheme } from "../../../lib/theme";

export default function Cases() {
  const { t, lang, me, refreshMe } = useAuth();
  const { c } = useTheme();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [burst, setBurst] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ cases: CaseSummary[] }>("/api/v1/cases");
      setCases(r.cases);
      setError(null);
      setDismissed(await dismissedApprovals());
      const approved = r.cases.filter((x) => x.recentApprovalAt).map((x) => x.id);
      if ((await takeUnplayed(approved)).length > 0) setBurst(Date.now());
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
  const approvals = dismissed ? (cases ?? []).filter((x) => x.recentApprovalAt && !dismissed.includes(x.id)) : [];
  return (
    <View style={{ flex: 1 }}>
      <Screen
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
      >
        {approvals.map((x) => (
          <View key={x.id} accessibilityRole="summary" style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            <FlagStripe />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), padding: space(3) }}>
              <StarsMark size={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Body style={{ fontWeight: "700" }}>{t.congratsTitle}</Body>
                <Small muted={false}>{t.approvedBanner(x.nickname ?? x.receiptMasked)}</Small>
                <Pressable accessibilityRole="link" onPress={() => router.push(`/cases/${x.id}`)} hitSlop={6} style={{ alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ color: c.accent, fontWeight: "600", fontSize: 14 }}>{t.viewCase}</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.dismiss}
                hitSlop={10}
                onPress={async () => {
                  await dismissApproval(x.id);
                  setDismissed((d) => [...(d ?? []), x.id]);
                }}
                style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: c.muted, fontSize: 18 }}>×</Text>
              </Pressable>
            </View>
          </View>
        ))}
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
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space(2) }}>
                <Body style={{ fontWeight: "700", flex: 1 }}>{cs.nickname ?? cs.receiptMasked}</Body>
                <StatusPill category={cs.category} label={t.category[cs.category]} />
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
      <StarBurst playKey={burst} />
    </View>
  );
}
