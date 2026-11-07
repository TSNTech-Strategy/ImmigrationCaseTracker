import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Screen, Small } from "../../../components/ui";
import { CaseCard, CaseCardSkeleton, IconButton, LargeHeader, SearchField, caseTitles } from "../../../components/cases";
import { FlagStripe, StarBurst, StarsMark, dismissApproval, dismissedApprovals, takeUnplayed } from "../../../components/celebration";
import { FeatureRow, IconTile, Segmented, TwoToneTitle, type Glyph, type Tint } from "../../../components/feature";
import { COMPLETED_PREVIEW, CourtGuideView, GROUP_ORDER, GroupHeader, SummaryTiles, glanceOf, matchesFilter } from "../../../components/my-cases";
import { CourtCasesSection } from "../../../components/court";
import { loadCourtCases, type CourtCase } from "../../../lib/court-cases";
import { Icon } from "../../../components/icon";
import { FadeInDown, stagger, useSpotlight } from "../../../components/motion";
import { api, ApiError, type CaseFilter, type CaseSummary, type CourtResponse } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { takePrefetchedCases, type CasesResponse } from "../../../lib/cases-prefetch";
import { launchDone } from "../../../lib/launch";
import { timeAgo, trialDaysLeft } from "../../../lib/i18n";
import { journeySpan } from "../../../lib/days";
import { hasNewChange, seenChanges } from "../../../lib/seen";
import { radius, space, useTheme } from "../../../lib/theme";
import { useRefreshOnForeground } from "../../../lib/use-refresh";
import { canScanReceipts } from "../../../lib/scan";
import { NewTagChip, TagChip } from "../../../components/tags";
import { tagsInUse } from "../../../lib/tags";
import { setUnreadUpdates } from "../../../lib/updates-badge";

const EMPTY_FEATURES: { key: "updates" | "clear" | "secure"; glyph: Glyph; tint: Tint }[] = [
  { key: "updates", glyph: { ios: "bell", md: "notifications", fallback: "!" }, tint: "green" },
  { key: "clear", glyph: { ios: "clock", md: "schedule", fallback: "◷" }, tint: "amber" },
  { key: "secure", glyph: { ios: "checkmark.shield", md: "verified_user", fallback: "✓" }, tint: "blue" },
];

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
  // USCIS cases, or the immigration court guide.
  const [segment, setSegment] = useState<"uscis" | "court">("uscis");
  const [court, setCourt] = useState<CourtResponse | null>(null);
  // Court cases are kept on this phone only.
  const [courtCases, setCourtCases] = useState<CourtCase[]>([]);
  const [courtError, setCourtError] = useState<string | null>(null);
  // A summary tile picked (only those cases), and whether every completed case is shown.
  const [tile, setTile] = useState<CaseFilter | null>(null);
  const [allCompleted, setAllCompleted] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  // First-case screen: a highlight walks down the three features.
  const spot = useSpotlight(EMPTY_FEATURES.length);

  const load = useCallback(async () => {
    try {
      // The first time, the list the app started loading during launch.
      const r = await (takePrefetchedCases() ?? api<CasesResponse>("/api/v1/cases"));
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
      loadCourtCases().then(setCourtCases);
    }, [load]),
  );
  useRefreshOnForeground(load);

  // The court guide comes from the server (wording can improve without an app release); loaded the first time it's opened.
  useEffect(() => {
    if (segment !== "court" || court) return;
    api<CourtResponse>("/api/v1/court")
      .then((r) => {
        setCourt(r);
        setCourtError(null);
      })
      .catch((e) => setCourtError(e instanceof ApiError ? e.message : String(e)));
  }, [segment, court]);

  // The cases (or an error) are on screen: the launch screen can fade into them.
  const loaded = cases !== null || error !== null;
  useEffect(() => {
    if (loaded) requestAnimationFrame(() => launchDone());
  }, [loaded]);

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

  const list = useMemo(() => cases ?? [], [cases]);
  const lastChecked = list.reduce<string | null>((max, x) => (x.lastCheckedAt && (!max || x.lastCheckedAt > max) ? x.lastCheckedAt : max), null);
  // Tile counts: every case, whatever the search or tag.
  const tileCounts = useMemo(() => {
    const out: Record<CaseFilter, number> = { attention: 0, interview: 0, approved: 0, active: 0, completed: 0 };
    for (const x of list) {
      const g = glanceOf(x);
      for (const f of Object.keys(out) as CaseFilter[]) if (matchesFilter(g, f)) out[f]++;
    }
    return out;
  }, [list]);
  const tagChips = useMemo(() => tagsInUse(list), [list]);
  // A tag that was deleted or taken off every case stops filtering.
  const activeTag = tagFilter && tagChips.some((x) => x.id === tagFilter) ? tagFilter : null;
  const q = query.trim().toLowerCase();
  const shown = list.filter((x) => {
    if (tile && !matchesFilter(glanceOf(x), tile)) return false;
    if (activeTag && !(x.tags ?? []).some((tg) => tg.id === activeTag)) return false;
    if (!q) return true;
    const { title, sub } = caseTitles(x, lang);
    return [title, sub, x.statusTitleEn, x.statusTitleEs, x.formType, ...(x.tags ?? []).map((tg) => tg.name)].some((v) => v?.toLowerCase().includes(q));
  });
  const approvals = dismissed ? list.filter((x) => x.recentApprovalAt && !dismissed.includes(x.id)) : [];
  // The Updates tab's badge: cases with changes this phone hasn't shown yet.
  const unseen = seen ? list.filter((x) => hasNewChange(seen, x)).length : 0;
  useEffect(() => {
    if (seen) setUnreadUpdates(unseen);
  }, [seen, unseen]);
  // My timeline: the same span the timeline screen shows.
  const span = journeySpan(list);
  const days = trialDaysLeft(me?.plan.trialEndsAt ?? null);
  // Searching, a tag or a tile: every match shows. Otherwise the list is in sections and older completed cases fold away.
  const narrowed = Boolean(q || activeTag || tile);
  const sections = GROUP_ORDER.map((group) => ({ group, items: shown.filter((x) => glanceOf(x).group === group) })).filter((sec) => sec.items.length > 0);
  const card = (cs: CaseSummary, i: number) => (
    <FadeInDown key={cs.id} delay={stagger(i, 70)}>
      <CaseCard cs={cs} stageCount={stageCount} isNew={hasNewChange(seen, cs)} lang={lang} onPress={() => router.push(`/cases/${cs.id}`)} />
    </FadeInDown>
  );

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
          // While loading, keep the line (no "add a case" flash before the list arrives).
          subtitle={segment === "court" ? t.courtSub : !loaded ? "\u00a0" : lastChecked ? t.checkedAgo(timeAgo(lastChecked, lang)) : t.noChecksYet}
          right={
            segment === "uscis" ? (
              <>
                {(!loaded || list.length > 0) && <IconButton ios="arrow.clockwise" md="refresh" label={t.checkAll} onPress={checkAll} loading={checking} fallback="↻" />}
                <IconButton ios="plus" md="add" label={t.addCase} onPress={() => router.push("/cases/new")} filled fallback="+" />
              </>
            ) : (
              <View style={{ height: 44 }} />
            )
          }
        />

        <Segmented
          label={t.segLabel}
          value={segment}
          onChange={setSegment}
          options={[
            { value: "uscis", label: loaded ? t.segCount(t.segUscis, list.length) : t.segUscis, glyph: { ios: "doc.text", md: "description", fallback: "▤" } },
            { value: "court", label: t.segCount(t.segCourt, courtCases.length), glyph: { ios: "building.columns", md: "account_balance", fallback: "⚖" } },
          ]}
        />

        {segment === "court" ? (
          <>
            <CourtCasesSection cases={courtCases} lang={lang} />
            {court ? (
              <CourtGuideView data={court} lang={lang} />
            ) : courtError ? (
              <Banner tone="danger">{courtError}</Banner>
            ) : (
              <View style={{ gap: space(3) }}>
                <CaseCardSkeleton />
              </View>
            )}
          </>
        ) : (
          <>

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

        {loaded && list.length > 0 && <SummaryTiles counts={tileCounts} value={tile} onChange={setTile} lang={lang} />}
        {loaded && span && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.journeyTitle}. ${t.journeyCard(span.days, span.cases)}`}
            onPress={() => router.push("/journey")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space(3),
              padding: space(3.5),
              borderRadius: radius.lg,
              backgroundColor: pressed ? c.surface2 : c.surface,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: c.border,
            })}
          >
            <IconTile glyph={{ ios: "chart.bar.xaxis", md: "timeline", fallback: "▤" }} tint="blue" size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.journeyTitle}</Text>
              <Text style={{ fontSize: 13, color: c.muted }}>{t.journeyCard(span.days, span.cases)}</Text>
            </View>
            <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
          </Pressable>
        )}

        {list.length >= 3 && <SearchField value={query} onChangeText={setQuery} placeholder={t.searchCases} />}

        {loaded && list.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t.filterByTag} contentContainerStyle={{ gap: space(2), alignItems: "center" }}>
            {tagChips.map((tg) => (
              <TagChip key={tg.id} tag={tg} count={tg.count} selected={activeTag === tg.id} onPress={() => setTagFilter(activeTag === tg.id ? null : tg.id)} />
            ))}
            <NewTagChip label={tagChips.length ? t.manageTags : t.newTag} edit={tagChips.length > 0} onPress={() => router.push("/tags")} />
          </ScrollView>
        )}

        {!loaded && (
          <View style={{ gap: space(3) }}>
            <CaseCardSkeleton label={t.loadingCases} />
            <CaseCardSkeleton />
          </View>
        )}

        {cases && cases.length === 0 && (
          <FadeInDown>
            <Card style={{ padding: space(5), gap: space(5), borderRadius: radius.lg + 6 }}>
              <View style={{ gap: space(2) }}>
                <TwoToneTitle first={t.emptyFirst} second={t.emptySecond} size={28} />
                <Body muted>{t.emptyBody}</Body>
              </View>
              {EMPTY_FEATURES.map((f, i) => (
                <FadeInDown key={f.key} delay={stagger(i, 120, 150)}>
                  <FeatureRow glyph={f.glyph} tint={f.tint} title={t.emptyFeatures[f.key].title} text={t.emptyFeatures[f.key].text} drop={stagger(i, 120, 280)} active={spot === i} />
                </FadeInDown>
              ))}
              <FadeInDown delay={stagger(3, 120, 150)} style={{ gap: space(3) }}>
                <Button title={t.addFirstCase} onPress={() => router.push("/cases/new")} icon={{ ios: "plus", md: "add", fallback: "+" }} />
                {canScanReceipts && (
                  <Button
                    title={t.scanTitle}
                    variant="secondary"
                    onPress={() => router.push("/cases/new?scan=camera")}
                    icon={{ ios: "camera.viewfinder", md: "document_scanner", fallback: "▣" }}
                  />
                )}
                <Small style={{ textAlign: "center" }}>{t.receiptWhere}</Small>
              </FadeInDown>
            </Card>
          </FadeInDown>
        )}
        {tile && list.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontSize: 15, fontWeight: "700", color: c.heading }}>
              {t.filterShowing(t.tile[tile], shown.length)}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setTile(null)} hitSlop={8}>
              <Text style={{ color: c.accent, fontWeight: "600", fontSize: 14 }}>{t.showAllCases}</Text>
            </Pressable>
          </View>
        )}
        {list.length > 0 && shown.length === 0 && <Small style={{ textAlign: "center" }}>{tile && !q && !activeTag ? t.noneForFilter : t.noMatches}</Small>}
        {tile
          ? shown.map(card)
          : sections.map((sec) => {
              const fold = sec.group === "completed" && !narrowed && !allCompleted && sec.items.length > COMPLETED_PREVIEW;
              const canFold = sec.group === "completed" && !narrowed && sec.items.length > COMPLETED_PREVIEW;
              return (
                <View key={sec.group} style={{ gap: space(3) }}>
                  <GroupHeader
                    title={t.group[sec.group]}
                    count={sec.items.length}
                    action={canFold ? { label: allCompleted ? t.showLess : t.viewAll(sec.items.length), onPress: () => setAllCompleted((v) => !v) } : undefined}
                  />
                  {(fold ? sec.items.slice(0, COMPLETED_PREVIEW) : sec.items).map(card)}
                </View>
              );
            })}
          </>
        )}
        <Small style={{ textAlign: "center" }}>{t.disclaimer}</Small>
      </Screen>
      <StarBurst playKey={burst} />
    </View>
  );
}
