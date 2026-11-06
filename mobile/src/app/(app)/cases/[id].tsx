import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Banner, Body, Button, Card, Field, H1, H2, Loading, Row, Screen, Small, StatusPill, Timeline } from "../../../components/ui";
import { CongratsCard, StarBurst, takeUnplayed } from "../../../components/celebration";
import { CaseSubline, Stepper, caseTitles } from "../../../components/cases";
import { Icon } from "../../../components/icon";
import { markSeen } from "../../../lib/seen";
import { api, ApiError, type CaseDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { config } from "../../../lib/config";
import { formatDate } from "../../../lib/i18n";
import { useRefreshOnForeground } from "../../../lib/use-refresh";
import { space, useTheme } from "../../../lib/theme";

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
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useRefreshOnForeground(load);

  if (error && !cs) return <Screen><Banner tone="danger">{error}</Banner></Screen>;
  if (!cs) return <Loading />;

  const es = lang === "es";
  const title = (es ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn ?? t.notChecked;
  const desc = (es ? cs.statusDescriptionEs : cs.statusDescriptionEn) ?? cs.statusDescriptionEn;
  const paused = cs.pausedReason === "plan_limit";
  const free = me?.plan.id === "FREE";
  const guide = cs.guide ? cs.guide[lang] : null;
  const officeName = cs.office?.name ? cs.office.name[lang] : null;
  const history = cs.uscisHistory ?? [];
  const names = caseTitles(cs, lang);
  const stepLabel = cs.stage !== null ? t.stepOf(cs.stage + 1, 4, t.stages[cs.stage] ?? "") : undefined;

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
        <Stack.Screen options={{ title: names.title }} />
        {renaming === null ? (
          <View style={{ gap: space(1) }}>
            <H1>{names.title}</H1>
            <CaseSubline mono={names.mono} text={names.text} />
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
            <StatusPill category={cs.category} label={t.category[cs.category]} />
          </View>
          <H2 style={{ fontSize: 22 }}>{title}</H2>
          {cs.stage !== null && <Stepper stage={cs.stage} total={4} category={cs.category} label={stepLabel} />}
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

          <View style={{ gap: space(3), marginTop: space(2) }}>
            <Row label={t.lastChecked} value={formatDate(cs.lastCheckedAt, lang, t.never)} />
            <Row label={t.lastChange} value={formatDate(cs.lastChangeObservedAt, lang, t.noneYet)} />
          </View>
          {!paused && <Button title={busy === "check" ? t.checking : t.checkNow} onPress={checkNow} loading={busy === "check"} />}
          {note && <Banner tone={note.tone}>{note.text}</Banner>}
          <Small>{free ? t.freePlan : t.premiumPlan} {t.uscisSource}</Small>
        </Card>

        {(cs.form || cs.office) && (
          <Card>
            {cs.form && <Row label={t.form} value={cs.form.name ? `${cs.form.code} · ${cs.form.name[lang]}` : cs.form.code} />}
            {cs.office && <Row label={t.receivedAt} value={officeName ? `${officeName} (${cs.office.code})` : t.officeCode(cs.office.code)} />}
            <View style={{ gap: space(1), marginTop: space(1) }}>
              <Label>{t.howLong}</Label>
              <Small>{t.processingHint(cs.form?.code ?? null, officeName)}</Small>
              <LinkText title={t.processingTimes} onPress={() => WebBrowser.openBrowserAsync(cs.processingTimesUrl)} />
            </View>
          </Card>
        )}

        <H2>{t.changesSeen}</H2>
        {cs.events.length === 0 ? (
          <Small>{t.nothingYet}</Small>
        ) : (
          <Timeline
            items={cs.events.map((e) => ({
              key: e.id,
              title: (es ? e.statusTitleEs : e.statusTitleEn) ?? e.statusTitleEn ?? "—",
              meta: formatDate(e.firstObservedAt, lang, ""),
              category: e.category,
            }))}
          />
        )}

        {history.length > 0 && (
          <>
            <H2>{t.uscisHistory}</H2>
            <Timeline
              items={history.map((h, i) => ({
                key: String(i),
                title: (es ? h.textEs : h.textEn) ?? h.textEn ?? "—",
                meta: h.date?.raw ?? undefined,
                category: h.category,
              }))}
            />
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
      <StarBurst playKey={burst} />
    </View>
  );
}
