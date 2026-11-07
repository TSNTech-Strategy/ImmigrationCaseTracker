import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Card, Loading, Screen, Small } from "../../../components/ui";
import { Segmented } from "../../../components/feature";
import { FadeInDown, stagger } from "../../../components/motion";
import { EmphasisBars, Meter, MonthColumns, NotEnough, ShareBars, StatTile } from "../../../components/insights";
import { api, ApiError, type Insights, type InsightsWindow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDay } from "../../../lib/i18n";
import { space, useTheme } from "../../../lib/theme";

function Label({ children }: { children: string }) {
  return <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{children}</Small>;
}

/** Case insights: how this case compares with CasePingo cases like it (anonymous totals). */
export default function CaseInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState<InsightsWindow>("30d");

  const load = useCallback(async () => {
    try {
      const r = await api<{ insights: Insights }>(`/api/v1/cases/${id}/insights`);
      setData(r.insights);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data && !error) return <Loading />;
  if (!data) {
    return (
      <Screen>
        <Banner tone="danger">{error ?? ""}</Banner>
      </Screen>
    );
  }

  const n = (x: number) => x.toLocaleString(lang === "es" ? "es-US" : "en-US");
  const notEnough = t.insightsNotEnough(data.minGroup);
  const you = data.yourCase;
  const officeName = you.office ? (you.office.name ? `${you.office.name[lang]} (${you.office.code})` : you.office.code) : null;
  const activity = data.activity.find((a) => a.window === win) ?? data.activity[0];
  const form = data.form?.code ?? null;

  return (
    <Screen>
      {data.mode !== "production" && <Banner tone="plain">{t.insightsDemo}</Banner>}
      <FadeInDown>
        <Text style={{ fontSize: 15, color: c.muted, lineHeight: 21 }}>
          {!form ? t.insightsNoForm : data.poolSize ? t.insightsBasedOn(data.poolSize, form) : t.insightsCollecting(form)}
        </Text>
      </FadeInDown>

      <FadeInDown delay={stagger(1, 60)}>
        <Card>
          <Label>{t.insightsYourCase}</Label>
          <View style={{ flexDirection: "row", gap: space(2) }}>
            <StatTile label={you.finished ? t.insightsTotalTime : t.insightsSinceFiling} value={you.days !== null ? t.dayCount(you.days) : "—"} />
            {you.finished ? (
              <StatTile label={t.insightsFinished} value={formatDay(you.lastUpdate ?? null, lang)} compact />
            ) : (
              <StatTile label={t.insightsAtStatus} value={you.daysAtStatus !== null ? t.dayCount(you.daysAtStatus) : "—"} />
            )}
          </View>
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(2, 60)}>
        <Card>
          <Label>{t.insightsNext}</Label>
          {you.status && <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.insightsNextAfter(you.status[lang])}</Text>}
          {data.next ? (
            <>
              <Small>{t.insightsNextCases(data.next.cases)}</Small>
              <ShareBars
                rows={data.next.options.map((o) => ({
                  key: o.title.en,
                  label: o.title[lang],
                  share: o.share,
                  sub: o.medianDays !== null ? t.insightsMedian(o.medianDays) : undefined,
                }))}
              />
            </>
          ) : (
            !you.finished && <NotEnough text={notEnough} />
          )}
          {data.guideNext && (
            <View style={{ gap: 2, marginTop: space(1) }}>
              <Small style={{ fontWeight: "700" }}>{t.insightsGuideNext}</Small>
              <Text style={{ fontSize: 15, color: c.text, lineHeight: 21 }}>{data.guideNext[lang]}</Text>
            </View>
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(3, 60)}>
        <Card>
          <Label>{t.insightsSimilar}</Label>
          {data.similar ? (
            <>
              <Small>{t.insightsSimilarSub(data.similar.cases, data.similarWindowDays)}</Small>
              <EmphasisBars
                youLabel={t.insightsYou}
                rows={data.similar.steps.map((s) => ({ key: s.key, label: s.label[lang], value: s.cases, valueText: n(s.cases), you: s.you }))}
              />
              <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{t.insightsAhead(data.similar.aheadOf)}</Text>
              <Small>{t.insightsApprovedShare(data.similar.approvedShare)}</Small>
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(4, 60)}>
        <Card>
          <Label>{t.insightsOffices}</Label>
          {data.offices ? (
            <>
              <Small>{t.insightsOfficesSub}</Small>
              {data.offices.rows.length > 0 && (
                <EmphasisBars
                  youLabel={t.insightsYourOffice}
                  rows={data.offices.rows.map((r) => ({
                    key: r.code,
                    label: r.name ? `${r.code} · ${r.name[lang]}` : r.code,
                    value: r.medianDays,
                    valueText: t.dayCount(r.medianDays),
                    you: r.yours,
                  }))}
                />
              )}
              {data.offices.overallMedianDays !== null && (
                <Text style={{ fontSize: 14, color: c.text }}>{t.insightsAllOffices(data.offices.overallMedianDays, data.offices.cases)}</Text>
              )}
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(5, 60)}>
        <Card>
          <Label>{t.insightsRates}</Label>
          {data.rates ? (
            <View style={{ gap: space(4) }}>
              {data.rates.approval && <Meter tone="done" label={t.insightsApproved} value={data.rates.approval.rate} sub={t.insightsApprovedOf(data.rates.approval.decided)} />}
              {data.rates.rfe && <Meter tone="action" label={t.insightsRfe} value={data.rates.rfe.rate} sub={t.insightsRfeOf(data.rates.rfe.cases)} />}
            </View>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(6, 60)}>
        <Card>
          <Label>{t.insightsActivity}</Label>
          <Segmented
            label={t.insightsActivity}
            value={win}
            onChange={setWin}
            options={[
              { value: "7d", label: t.insightsWindow7d },
              { value: "30d", label: t.insightsWindow30d },
              { value: "12m", label: t.insightsWindow12m },
            ]}
          />
          {activity.cases !== null ? (
            <>
              <Small>{t.insightsActivityCases(activity.cases)}</Small>
              <ShareBars rows={activity.kinds.map((k) => ({ key: k.key, label: k.label[lang], share: k.share, sub: t.insightsCases(k.cases) }))} />
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(7, 60)}>
        <Card>
          <Label>{t.insightsTrend}</Label>
          {data.trend ? (
            <>
              <Small>{t.insightsTrendSub(data.trend.total)}</Small>
              <MonthColumns months={data.trend.months} lang={lang} />
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <FadeInDown delay={stagger(8, 60)}>
        <Card>
          <Label>{t.insightsOfficial}</Label>
          <Small>{t.insightsOfficialText(form, officeName)}</Small>
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(data.processingTimesUrl)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.processingTimes} ↗</Text>
          </Pressable>
        </Card>
      </FadeInDown>

      <Small style={{ textAlign: "center" }}>{t.insightsNote}</Small>
    </Screen>
  );
}
