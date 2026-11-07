import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Banner, Body, Button, Card, Field, H1, H2, Loading, Row, Screen, Small } from "../../../components/ui";
import { CongratsCard, StarBurst, takeUnplayed } from "../../../components/celebration";
import { Stepper, caseTitles } from "../../../components/cases";
import { LineMapView, StepChip } from "../../../components/line-map";
import { Icon } from "../../../components/icon";
import { IconTile } from "../../../components/feature";
import { launchDone } from "../../../lib/launch";
import { markSeen } from "../../../lib/seen";
import { api, ApiError, type CaseDetail, type GuideEntry, type StatusCategory } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { config } from "../../../lib/config";
import { FEATURES } from "../../../lib/features";
import { formatDate, formatDay, type Lang } from "../../../lib/i18n";
import { dayOf } from "../../../lib/days";
import { loadGuide } from "../../../lib/guide";
import { useRefreshOnForeground } from "../../../lib/use-refresh";
import { font, radius, space, useTheme } from "../../../lib/theme";
import { CaseTags } from "../../../components/tags";

function confirm(message: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(message) ?? true);
  return new Promise((resolve) =>
    Alert.alert(message, undefined, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function Label({ children }: { children: string }) {
  return <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{children}</Small>;
}

function LinkText({ title, onPress }: { title: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={{ alignSelf: "flex-start" }}>
      <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{title} ↗</Text>
    </Pressable>
  );
}

type HistoryItem = { key: string; titleEn: string | null; title: string; date: string | null; seenAt: string | null; fromUscis: boolean; category: StatusCategory };

/** One list of the case's history: USCIS's own entries and the changes CasePingo saw, newest first, without repeats. */
function caseHistory(cs: CaseDetail, lang: Lang): HistoryItem[] {
  const es = lang === "es";
  const byKey = new Map<string, HistoryItem>();
  const add = (item: HistoryItem) => {
    const k = `${(item.titleEn ?? item.title).toLowerCase()}|${item.date ?? ""}`;
    const prev = byKey.get(k);
    if (prev) {
      prev.seenAt ??= item.seenAt;
      prev.fromUscis ||= item.fromUscis;
    } else byKey.set(k, item);
  };
  (cs.uscisHistory ?? []).forEach((h, i) =>
    add({ key: `u${i}`, titleEn: h.textEn ?? null, title: (es ? h.textEs : h.textEn) ?? h.textEn ?? "—", date: dayOf(h.date?.raw), seenAt: null, fromUscis: true, category: h.category }),
  );
  cs.events.forEach((e) =>
    add({
      key: e.id,
      titleEn: e.statusTitleEn,
      title: (es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn ?? "—",
      date: dayOf(e.uscisReportedRaw) ?? dayOf(e.firstObservedAt),
      seenAt: e.firstObservedAt,
      fromUscis: false,
      category: e.category,
    }),
  );
  const items = [...byKey.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  // The current status always leads, even before USCIS lists it in its history.
  if (cs.statusTitleEn && items[0]?.titleEn?.toLowerCase() !== cs.statusTitleEn.toLowerCase()) {
    items.unshift({
      key: "current",
      titleEn: cs.statusTitleEn,
      title: (es ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn,
      date: cs.days?.lastUpdate ?? dayOf(cs.lastChangeObservedAt),
      seenAt: cs.lastChangeObservedAt,
      fromUscis: false,
      category: cs.category,
    });
  }
  return items;
}

/** A history entry: date and status; tap to read USCIS's message (current status) or what the status means. */
function HistoryRow({ item, detail, lang, last }: { item: HistoryItem; detail: string | null; lang: Lang; last: boolean }) {
  const { c } = useTheme();
  const { t } = useAuth();
  const [open, setOpen] = useState(false);
  const dot = c.st[item.category].fg;
  const meta = item.fromUscis ? t.reportedByUscis : item.seenAt ? t.seenByUs(formatDate(item.seenAt, lang, "")) : null;
  return (
    <View style={{ flexDirection: "row", gap: space(3) }}>
      <View style={{ alignItems: "center", width: 12 }}>
        <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: dot, marginTop: 5 }} />
        {!last && <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginTop: 3 }} />}
      </View>
      <Pressable
        accessibilityRole={detail ? "button" : undefined}
        aria-expanded={detail ? open : undefined}
        disabled={!detail}
        onPress={() => setOpen((v) => !v)}
        style={{ flex: 1, paddingBottom: last ? 0 : space(4), gap: space(1) }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.accent }}>{formatDay(item.date, lang)}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space(2) }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: c.heading, lineHeight: 21 }}>{item.title}</Text>
          {detail && <Icon ios={open ? "chevron.up" : "chevron.down"} md={open ? "expand_less" : "expand_more"} size={13} color={c.muted} fallback={open ? "˄" : "˅"} />}
        </View>
        {open && detail && (
          <View style={{ backgroundColor: c.surface2, borderRadius: radius.md, padding: space(3), marginTop: space(1) }}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: c.text }}>{detail}</Text>
          </View>
        )}
        {meta && <Text style={{ fontSize: 12, color: c.muted }}>{meta}</Text>}
      </Pressable>
    </View>
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
  const [burst, setBurst] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ case: CaseDetail }>(`/api/v1/cases/${id}`);
      setCs(r.case);
      await markSeen(r.case.id, r.case.lastChangeObservedAt);
      // First time this phone sees the approval: stars and a little buzz.
      if (r.case.celebration && (await takeUnplayed([r.case.id])).length > 0) setBurst(Date.now());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
    // Opened from a notification at launch: the case is on screen now.
    requestAnimationFrame(() => launchDone());
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useRefreshOnForeground(load);

  const [entries, setEntries] = useState<GuideEntry[] | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  // The status library explains each past status in the history.
  useEffect(() => {
    loadGuide()
      .then((g) => setEntries(g.entries))
      .catch(() => {});
  }, []);
  const history = useMemo(() => (cs ? caseHistory(cs, lang) : []), [cs, lang]);
  const meaningOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries ?? []) for (const w of e.wordings) m.set(w.toLowerCase(), e[lang].meaning);
    return m;
  }, [entries, lang]);

  if (error && !cs) return <Screen><Banner tone="danger">{error}</Banner></Screen>;
  if (!cs) return <Loading />;

  const es = lang === "es";
  const title = (es ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn ?? t.notChecked;
  const desc = (es ? cs.statusDescriptionEs : cs.statusDescriptionEn) ?? cs.statusDescriptionEn;
  const paused = cs.pausedReason === "plan_limit";
  const free = me?.plan.id === "FREE";
  const guide = cs.guide ? cs.guide[lang] : null;
  const officeName = cs.office?.name ? cs.office.name[lang] : null;
  const names = caseTitles(cs, lang);
  const code = cs.form?.code ?? cs.formType;
  const map = cs.lineMap;
  const days = cs.days;
  const stepLabel = cs.stage !== null ? t.stepOf(cs.stage + 1, 4, t.stages[cs.stage] ?? "") : undefined;
  const shownHistory = allHistory ? history : history.slice(0, 4);

  async function saveName() {
    if (renaming === null) return;
    try {
      await api(`/api/v1/cases/${id}`, { method: "PATCH", body: { nickname: renaming.trim() || null } });
      setRenaming(null);
      await load();
    } catch (e) {
      setNote({ tone: "danger", text: e instanceof ApiError ? e.message : String(e) });
    }
  }

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
    <View style={{ flex: 1 }}>
      <Screen
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
      >
        <Stack.Screen options={{ title: code ? `${code} · ${cs.receiptMasked}` : cs.receiptMasked }} />
        {renaming === null ? (
          <View style={{ gap: space(1) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <Text style={[font.mono, { fontSize: 14, color: c.muted }]}>{cs.receiptMasked}</Text>
              {code ? (
                <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 6, backgroundColor: c.surface2 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: c.heading }}>{code}</Text>
                </View>
              ) : null}
            </View>
            <H1>{names.title}</H1>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRenaming(cs.nickname ?? "")}
              hitSlop={6}
              style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), alignSelf: "flex-start", marginTop: space(1) }}
            >
              <Icon ios="pencil" md="edit" size={15} color={c.accent} fallback="✎" />
              <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.rename}</Text>
            </Pressable>
          </View>
        ) : (
          <Card>
            <Field label={t.nickname} value={renaming} onChangeText={setRenaming} placeholder={t.renamePlaceholder} maxLength={60} autoFocus />
            <View style={{ flexDirection: "row", gap: space(2) }}>
              <View style={{ flex: 1 }}>
                <Button title={t.cancel} variant="secondary" onPress={() => setRenaming(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t.save} onPress={saveName} />
              </View>
            </View>
          </Card>
        )}

        {cs.celebration && (
          <CongratsCard
            title={t.congratsTitle}
            body={t.congratsBody}
            nextStep={cs.celebration.nextStep ? cs.celebration.nextStep[lang] : null}
            approvedLine={t.approvedOn(formatDate(cs.celebration.approvedAt, lang, ""))}
            replayLabel={t.celebrateAgain}
            onReplay={() => setBurst(Date.now())}
          />
        )}

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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
            <Label>{t.currentStatus}</Label>
            {map ? <StepChip map={map} lang={lang} /> : null}
          </View>
          <H2 style={{ fontSize: 22 }}>{title}</H2>
          {!map && cs.stage !== null && <Stepper stage={cs.stage} total={4} category={cs.category} label={stepLabel} />}
          {desc && <Body>{desc.replace(/<[^>]+>/g, "")}</Body>}
          {guide && cs.guide && (
            <View style={{ backgroundColor: c.surface2, borderRadius: 10, padding: space(3), gap: space(3), marginTop: space(1) }}>
              <View style={{ gap: 2 }}>
                <Label>{t.whatItMeans}</Label>
                <Body>{guide.meaning}</Body>
              </View>
              <View style={{ gap: 2 }}>
                <Label>{t.whatsNext}</Label>
                <Body>{guide.next}</Body>
              </View>
              {guide.todo && (
                <View style={{ gap: 2 }}>
                  <Label>{t.whatYouCanDo}</Label>
                  <Body>{guide.todo}</Body>
                </View>
              )}
              <Small style={{ fontSize: 12 }}>{t.guideNote}</Small>
              <LinkText title={t.moreAboutStatus} onPress={() => WebBrowser.openBrowserAsync(`${config.apiUrl}${cs.guide!.path}`)} />
            </View>
          )}
        </Card>

        {map && map.current >= 0 && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space(2) }}>
              <Label>{t.lineMap}</Label>
              <Text style={{ fontSize: 14, fontWeight: "700", color: c.heading }}>{map.name[lang]}</Text>
            </View>
            <LineMapView map={map} lang={lang} />
          </Card>
        )}

        {cs.checklist && (
          <Card onPress={() => router.push(`/checklists/${cs.checklist!.key}`)} label={t.checklistDocsFor(cs.checklist.form)} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <IconTile glyph={{ ios: "checklist", md: "checklist", fallback: "☑" }} tint="green" size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.checklistDocsFor(cs.checklist.form)}</Text>
              <Small>{t.checklistDocsText}</Small>
            </View>
            <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
          </Card>
        )}

        <Card onPress={() => router.push(`/insights/${cs.id}`)} label={t.insightsCard} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
          <IconTile glyph={{ ios: "chart.bar.xaxis", md: "bar_chart", fallback: "▤" }} tint="blue" size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.insightsCard}</Text>
            <Small>{t.insightsCardText}</Small>
          </View>
          <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
        </Card>

        <Card>
          <Label>{t.caseDetails}</Label>
          <View style={{ gap: space(3) }}>
            {cs.form && <Row label={t.form} value={cs.form.name ? `${cs.form.code} · ${cs.form.name[lang]}` : cs.form.code} />}
            {cs.office && <Row label={t.receivedAt} value={officeName ? `${officeName} (${cs.office.code})` : t.officeCode(cs.office.code)} />}
            {days?.filed && <Row label={t.filed} value={formatDay(days.filed, lang)} />}
            {days?.total !== null && days?.total !== undefined && <Row label={t.total} value={t.dayCount(days.total)} />}
            {days?.sinceUpdate !== null && days?.sinceUpdate !== undefined && <Row label={t.lastUpdate} value={t.daysAgoLong(days.sinceUpdate)} />}
            <Row label={t.lastChecked} value={formatDate(cs.lastCheckedAt, lang, t.never)} />
          </View>
          {!paused && <Button title={busy === "check" ? t.checking : t.checkNow} onPress={checkNow} loading={busy === "check"} />}
          {note && <Banner tone={note.tone}>{note.text}</Banner>}
          <Small>{free ? t.freePlan : t.premiumPlan} {t.uscisSource}</Small>
        </Card>

        <Card>
          <Label>{t.caseHistory}</Label>
          {history.length === 0 ? (
            <Small>{t.nothingYet}</Small>
          ) : (
            <View>
              {shownHistory.map((item, i) => (
                <HistoryRow
                  key={item.key}
                  item={item}
                  lang={lang}
                  last={i === shownHistory.length - 1}
                  detail={i === 0 && desc ? desc.replace(/<[^>]+>/g, "") : item.titleEn ? (meaningOf.get(item.titleEn.toLowerCase()) ?? null) : null}
                />
              ))}
            </View>
          )}
          {history.length > 4 && (
            <Pressable accessibilityRole="button" onPress={() => setAllHistory((v) => !v)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
              <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{allHistory ? t.showFewer : t.showAllUpdates(history.length)}</Text>
            </Pressable>
          )}
        </Card>

        <CaseTags caseId={cs.id} value={cs.tags ?? []} onChange={(tags) => setCs((prev) => (prev ? { ...prev, tags } : prev))} />

        {FEATURES.assistant && (
          <Card onPress={() => router.push({ pathname: "/assistant", params: { case: cs.id } })} label={t.assistantAskButton} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <Icon ios="sparkles" md="auto_awesome" size={22} color={c.accent} fallback="✦" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.assistantAskCase}</Text>
              <Small>{t.assistantAskCaseBody}</Small>
            </View>
            <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
          </Card>
        )}

        {(cs.form || cs.office) && (
          <Card>
            <Label>{t.howLong}</Label>
            <Small>{t.processingHint(cs.form?.code ?? null, officeName)}</Small>
            <LinkText title={t.processingTimes} onPress={() => WebBrowser.openBrowserAsync(cs.processingTimesUrl)} />
          </Card>
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
      <StarBurst playKey={burst} />
    </View>
  );
}
