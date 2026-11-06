import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Screen, Small } from "../../../components/ui";
import { CaseCard, FilterChips, IconButton, LargeHeader, SearchField, caseTitles } from "../../../components/cases";
import { FlagStripe, StarBurst, StarsMark, dismissApproval, dismissedApprovals, takeUnplayed } from "../../../components/celebration";
import { api, ApiError, type CaseSummary, type StatusCategory } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { timeAgo, trialDaysLeft } from "../../../lib/i18n";
import { hasNewChange, seenChanges } from "../../../lib/seen";
import { radius, space, useTheme } from "../../../lib/theme";
import { useRefreshOnForeground } from "../../../lib/use-refresh";

const FILTER_ORDER: StatusCategory[] = ["action", "progress", "done", "stop", "none"];

export default function Cases() {
  const { t, lang, me, refreshMe } = useAuth();
  const { c } = useTheme();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [stageCount, setStageCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [seen, setSeen] = useState<Record<string, string> | null>(null);
  const [burst, setBurst] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusCategory | "all">("all");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ cases: CaseSummary[]; stageCount?: number }>("/api/v1/cases");
      setCases(r.cases);
      setStageCount(r.stageCount ?? 4);
      setError(null);
      setSeen(await seenChanges(r.cases));
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
  useRefreshOnForeground(load);

  /** Ask USCIS about every active case (limits and cooldowns still apply on the server). */
  async function checkAll() {
    if (!cases || checking) return;
    setChecking(true);
    setNote(null);
    let checked = 0;
    let changed = 0;
    let skipped = 0;
    let reason = "";
    for (const cs of cases.filter((x) => x.trackingStatus === "ACTIVE")) {
      try {
        const r = await api<{ changed?: boolean }>(`/api/v1/cases/${cs.id}/refresh`, { method: "POST" });
        checked++;
        if (r.changed) changed++;
      } catch (e) {
        skipped++;
        reason = e instanceof ApiError ? e.message : String(e);
        if (e instanceof ApiError && (e.code === "limit" || e.code === "budget")) break;
      }
    }
    await load();
    setNote({ tone: checked === 0 && skipped > 0 ? "danger" : "success", text: t.checkAllResult(checked, changed, skipped, reason) });
    setChecking(false);
  }

  const list = cases ?? [];
  const lastChecked = list.reduce<string | null>((max, x) => (x.lastCheckedAt && (!max || x.lastCheckedAt > max) ? x.lastCheckedAt : max), null);
  const counts = useMemo(() => {
    const m = new Map<StatusCategory, number>();
    for (const x of list) m.set(x.category, (m.get(x.category) ?? 0) + 1);
    return m;
  }, [list]);
  const q = query.trim().toLowerCase();
  const shown = list.filter((x) => {
    if (filter !== "all" && x.category !== filter) return false;
    if (!q) return true;
    const { title, sub } = caseTitles(x, lang);
    return [title, sub, x.statusTitleEn, x.statusTitleEs, x.formType].some((v) => v?.toLowerCase().includes(q));
  });
  const approvals = dismissed ? list.filter((x) => x.recentApprovalAt && !dismissed.includes(x.id)) : [];
  const days = trialDaysLeft(me?.plan.trialEndsAt ?? null);
  const showFilters = list.length >= 2 && counts.size > 1;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        tab
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
      >
        <LargeHeader
          title={t.myCases}
          subtitle={lastChecked ? t.checkedAgo(timeAgo(lastChecked, lang)) : t.noChecksYet}
          right={
            <>
              {list.length > 0 && <IconButton ios="arrow.clockwise" md="refresh" label={t.checkAll} onPress={checkAll} loading={checking} fallback="↻" />}
              <IconButton ios="plus" md="add" label={t.addCase} onPress={() => router.push("/cases/new")} filled fallback="+" />
            </>
          }
        />

        {approvals.map((x) => (
          <View key={x.id} accessibilityRole="summary" style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            <FlagStripe />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), padding: space(3) }}>
              <StarsMark size={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Body style={{ fontWeight: "700" }}>{t.congratsTitle}</Body>
                <Small muted={false}>{t.approvedBanner(caseTitles(x, lang).title)}</Small>
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

        {days > 0 ? <Banner tone="info">{t.trialLeft(days)}</Banner> : me?.plan.id === "FREE" ? <Small>{t.freePlanShort}</Small> : null}
        {note && <Banner tone={note.tone}>{note.text}</Banner>}
        {error && <Banner tone="danger">{error}</Banner>}

        {list.length >= 3 && <SearchField value={query} onChangeText={setQuery} placeholder={t.searchCases} />}
        {showFilters && (
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all" as const, label: t.all, count: list.length },
              ...FILTER_ORDER.filter((k) => counts.get(k)).map((k) => ({ key: k, label: t.category[k], count: counts.get(k) ?? 0 })),
            ]}
          />
        )}

        {cases && cases.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space(8), gap: space(3) }}>
            <Body style={{ fontWeight: "700", textAlign: "center" }}>{t.noCases}</Body>
            <Small style={{ textAlign: "center" }}>{t.receiptWhere}</Small>
            <View style={{ alignSelf: "stretch" }}>
              <Button title={t.addFirstCase} onPress={() => router.push("/cases/new")} />
            </View>
          </Card>
        )}
        {list.length > 0 && shown.length === 0 && <Small style={{ textAlign: "center" }}>{t.noMatches}</Small>}
        {shown.map((cs) => (
          <CaseCard key={cs.id} cs={cs} stageCount={stageCount} isNew={hasNewChange(seen, cs)} lang={lang} onPress={() => router.push(`/cases/${cs.id}`)} />
        ))}
        <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
      </Screen>
      <StarBurst playKey={burst} />
    </View>
  );
}
