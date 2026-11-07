import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Card, Loading, Screen, Small } from "../../../components/ui";
import { Segmented } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { FadeInDown, stagger } from "../../../components/motion";
import { CardHead, Donut, DonutLegend, EmphasisBars, MonthlyChart, NotEnough, OfficeBars, RankingMini, Ring, StackedMonths, monthName } from "../../../components/insights";
import { api, ApiError, type Insights, type InsightsWindow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDay } from "../../../lib/i18n";
import { radius, space, useTheme } from "../../../lib/theme";

/**
 * Case analysis: how this case compares with CasePingo cases like it. The sections follow
 * Lawfully's Analysis screens (monthly approvals, similar cases, today's update, time by
 * receipt number, processing time, next message, approval & RFE rate, processing trend),
 * built from CasePingo's own anonymous totals and drawn in CasePingo's style.
 */
export default function CaseAnalysis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [winSel, setWinSel] = useState<InsightsWindow | null>(null);
  const [pickedSel, setPickedSel] = useState<string | null>(null);
  const [officeSel, setOfficeSel] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);

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

  const loc = lang === "es" ? "es-US" : "en-US";
  const n = (x: number) => x.toLocaleString(loc);
  const notEnough = t.insightsNotEnough(data.minGroup);
  const form = data.form?.code ?? null;
  const you = data.yourCase;

  // Today's update: the first window that has data unless one was picked.
  const win = winSel ?? data.activity.find((a) => a.cases !== null)?.window ?? "day";
  const activity = data.activity.find((a) => a.window === win) ?? data.activity[0];
  const slices = activity.kinds.map((k) => ({ key: k.key, label: k.label[lang], share: k.share, value: k.cases }));
  const picked = pickedSel && slices.some((s) => s.key === pickedSel) ? pickedSel : (slices[0]?.key ?? "");
  const from = activity.from ?? "";
  const center =
    win === "day" && from
      ? new Intl.DateTimeFormat(loc, { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`)).replace(".", "")
      : win === "month" && from
        ? monthName(from.slice(0, 7), lang, "short", true)
        : from.slice(0, 4);
  const windowTitle = win === "day" ? t.anUpdatesDay : win === "month" ? t.anUpdatesMonth : t.anUpdatesYear;

  // Processing time: this case's office first, if it has enough cases.
  const offices = data.offices?.rows ?? [];
  const office = offices.find((o) => o.code === officeSel) ?? offices.find((o) => o.yours) ?? offices[0];
  const officeName = you.office ? (you.office.name ? `${you.office.name[lang]} (${you.office.code})` : you.office.code) : null;

  const next = data.next;
  const top = next?.options[0];
  const monthly = data.monthly ?? null;

  return (
    <Screen>
      {data.mode !== "production" && <Banner tone="plain">{t.insightsDemo}</Banner>}
      {!form && <NotEnough text={t.insightsNoForm} />}

      {/* Monthly approvals */}
      <FadeInDown>
        <Card>
          <CardHead glyph={{ ios: "chart.line.uptrend.xyaxis", md: "show_chart", fallback: "↗" }} title={t.anMonthly} sub={t.anMonthlySub} help={t.anMonthlyHelp} />
          {monthly ? (
            <MonthlyChart m={monthly} lang={lang} lastLabel={t.anMonthLast(monthName(monthly.lastMonth, lang))} thisLabel={t.anMonthThis(monthName(monthly.month, lang))} />
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      {/* Cases similar to your filed date */}
      {form && (
        <FadeInDown delay={stagger(1, 60)} style={{ gap: space(3) }}>
          <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.heading, letterSpacing: -0.3, marginTop: space(2) }}>
            {t.anSimilarHeading(form)}
          </Text>
          <Card>
            {data.similar ? (
              <>
                <View style={{ flexDirection: "row", gap: space(3) }}>
                  <View style={{ flex: 1, gap: space(2) }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.anRanking}</Text>
                    <Text style={{ fontSize: 16, color: c.text, lineHeight: 22 }}>{t.anRankingText}</Text>
                  </View>
                  <View style={{ width: 128, gap: space(2) }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted }}>{t.anRankingLabel}</Text>
                    <RankingMini steps={data.similar.steps} youLabel={t.insightsYou} />
                    {data.similar.rank !== undefined && data.similar.of !== undefined && (
                      <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.accentSoft, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: 3 }}>
                        <Icon ios="bolt.fill" md="bolt" size={12} color={c.accent} fallback="⚡" />
                        <Text style={{ fontSize: 13, fontWeight: "800", color: c.heading }}>{t.anRank(data.similar.rank, data.similar.of)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Button title={details ? t.anHideDetails : t.anSeeDetails} onPress={() => setDetails((v) => !v)} />
                {details && (
                  <View style={{ gap: space(3) }}>
                    <Small>{t.insightsSimilarSub(data.similar.cases, data.similarWindowDays)}</Small>
                    <EmphasisBars youLabel={t.insightsYou} rows={data.similar.steps.map((s) => ({ key: s.key, label: s.label[lang], value: s.cases, valueText: n(s.cases), you: s.you }))} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{t.insightsAhead(data.similar.aheadOf)}</Text>
                    <Small>{t.insightsApprovedShare(data.similar.approvedShare)}</Small>
                  </View>
                )}
                <Text style={{ textAlign: "center", fontSize: 15, color: c.accent, fontWeight: "600" }}>{t.anSimilarCount(data.similar.cases)}</Text>
              </>
            ) : (
              <NotEnough text={notEnough} />
            )}
          </Card>
        </FadeInDown>
      )}

      {/* Statistical analysis */}
      {form && (
        <FadeInDown delay={stagger(2, 60)} style={{ gap: space(1), marginTop: space(2), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.border }}>
          <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.heading, letterSpacing: -0.3 }}>
            {t.anStats(form)}
          </Text>
          {data.dataAsOf && <Small>{t.anUpdated(formatDay(data.dataAsOf, lang))}</Small>}
        </FadeInDown>
      )}

      <FadeInDown delay={stagger(3, 60)}>
        <Card>
          <CardHead glyph={{ ios: "calendar", md: "event", fallback: "▦" }} title={windowTitle} />
          <Segmented
            label={windowTitle}
            value={win}
            onChange={(w) => {
              setWinSel(w);
              setPickedSel(null);
            }}
            options={[
              { value: "day", label: t.anDaily },
              { value: "month", label: t.anMonthlyTab },
              { value: "year", label: t.anYearly },
            ]}
          />
          {activity.cases !== null && slices.length ? (
            <View style={{ gap: space(3) }}>
              <Donut slices={slices} picked={picked} center={center} />
              <Text style={{ textAlign: "center", fontSize: 16, fontWeight: "700", color: c.heading }}>{t.anTotalCases(activity.cases)}</Text>
              <Small style={{ textAlign: "center", fontSize: 12 }}>{t.anTapRow}</Small>
              <DonutLegend rows={slices} picked={picked} onPick={setPickedSel} seeMore={t.anSeeMore} hide={t.anHide} lang={lang} />
            </View>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      {/* Average time to approval by receipt number */}
      <FadeInDown delay={stagger(4, 60)}>
        <Card>
          <CardHead glyph={{ ios: "doc.text.magnifyingglass", md: "manage_search", fallback: "#" }} title={t.anReceipt} help={t.anReceiptHelp} />
          {offices.length ? (
            <>
              <OfficeBars rows={offices} youLabel={t.insightsYourOffice} days={t.dayCount} />
              {data.offices?.overallMedianDays !== null && data.offices?.overallMedianDays !== undefined && (
                <Small>{t.insightsAllOffices(data.offices.overallMedianDays, data.offices.cases)}</Small>
              )}
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      {/* USCIS processing time */}
      <FadeInDown delay={stagger(5, 60)}>
        <Card>
          <CardHead glyph={{ ios: "clock", md: "schedule", fallback: "⏱" }} title={t.anProcessing} sub={offices.length ? t.anProcessingPick : undefined} />
          {office ? (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
                {offices.map((o) => {
                  const on = o.code === office.code;
                  return (
                    <Pressable
                      key={o.code}
                      accessibilityRole="button"
                      aria-selected={on}
                      accessibilityLabel={o.name ? `${o.code} ${o.name[lang]}` : o.code}
                      onPress={() => setOfficeSel(o.code)}
                      style={{ paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: on ? "800" : "600", color: on ? c.accent : c.text }}>{o.code}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ backgroundColor: c.surface2, borderRadius: radius.md, padding: space(4), gap: 2 }}>
                <Small>{office.name ? office.name[lang] : office.code}</Small>
                <Text style={{ fontSize: 26, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>{t.dayCount(office.medianDays)}</Text>
                <Text style={{ fontSize: 14, color: c.text }}>{t.anAboutMonths(Math.max(1, Math.round(office.medianDays / 30.4)))}</Text>
                <Small style={{ fontSize: 12 }}>{t.anProcessingBasis(office.cases)}</Small>
              </View>
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
          <Small>{t.insightsOfficialText(form, officeName)}</Small>
          <Button title={t.anOfficial} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(data.processingTimesUrl)} />
        </Card>
      </FadeInDown>

      {/* What message will you get next? */}
      <FadeInDown delay={stagger(6, 60)}>
        <Card>
          <CardHead
            glyph={{ ios: "list.bullet.rectangle", md: "view_list", fallback: "≡" }}
            title={t.anNext}
            sub={t.anNextSub}
            right={
              next && next.options.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t.anNextOthers} onPress={() => setNextOpen((v) => !v)} hitSlop={8}>
                  <Icon ios={nextOpen ? "chevron.down" : "chevron.right"} md={nextOpen ? "expand_more" : "chevron_right"} size={16} color={c.heading} fallback="›" />
                </Pressable>
              ) : undefined
            }
          />
          {next && top ? (
            <>
              <View style={{ backgroundColor: c.surface2, borderRadius: radius.md, padding: space(4) }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: c.heading }}>{top.title[lang]}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, gap: 2, paddingRight: space(3) }}>
                  <Small>{t.anProbability}</Small>
                  <Text style={{ fontSize: 30, fontWeight: "800", color: c.heading }}>{top.share}%</Text>
                </View>
                <View style={{ width: StyleSheet.hairlineWidth * 2, backgroundColor: c.border }} />
                <View style={{ flex: 1, gap: 2, paddingLeft: space(4) }}>
                  <Small>{t.anAvgTime}</Small>
                  <Text style={{ fontSize: 30, fontWeight: "800", color: c.heading }}>{top.avgDays !== null && top.avgDays !== undefined ? t.dayCount(top.avgDays) : "—"}</Text>
                </View>
              </View>
              {nextOpen && (
                <View style={{ gap: space(2) }}>
                  <Small style={{ fontWeight: "700" }}>{t.anNextOthers}</Small>
                  {next.options.slice(1).map((o) => (
                    <View key={o.title.en} style={{ flexDirection: "row", alignItems: "center", gap: space(2), paddingVertical: space(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
                      <Text style={{ flex: 1, fontSize: 15, color: c.heading }}>{o.title[lang]}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: c.heading }}>{o.share}%</Text>
                      <Text style={{ fontSize: 13, color: c.muted, width: 70, textAlign: "right" }}>{o.avgDays !== null && o.avgDays !== undefined ? t.dayCount(o.avgDays) : "—"}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Small style={{ fontSize: 12 }}>{t.anNextBasis(next.cases)}</Small>
            </>
          ) : (
            !you.finished && <NotEnough text={notEnough} />
          )}
          {data.guideNext && (
            <View style={{ gap: 2 }}>
              <Small style={{ fontWeight: "700" }}>{t.insightsGuideNext}</Small>
              <Text style={{ fontSize: 15, color: c.text, lineHeight: 21 }}>{data.guideNext[lang]}</Text>
            </View>
          )}
        </Card>
      </FadeInDown>

      {/* Approval & RFE rate */}
      <FadeInDown delay={stagger(7, 60)}>
        <Card>
          <CardHead glyph={{ ios: "checkmark.seal", md: "verified", fallback: "✓" }} title={t.anRates} />
          {data.rates && form ? (
            <>
              <Small>
                {data.rates.approval
                  ? t.anRatesText(form, data.rates.approval.decided, data.rates.approval.rate, data.rates.rfe?.rate ?? null)
                  : data.rates.rfe
                    ? t.anRfeOnly(data.rates.rfe.rate, data.rates.rfe.cases)
                    : ""}
              </Small>
              <View style={{ flexDirection: "row", gap: space(2) }}>
                {data.rates.approval && <Ring value={data.rates.approval.rate} label={t.anApproval} color={c.st.done.fg} track={c.st.done.bg} />}
                {data.rates.rfe && <Ring value={data.rates.rfe.rate} label={t.anRfe} color={c.st.action.fg} track={c.st.action.bg} />}
              </View>
            </>
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      {/* Case processing trend */}
      <FadeInDown delay={stagger(8, 60)}>
        <Card>
          <CardHead glyph={{ ios: "building.columns", md: "account_balance", fallback: "▥" }} title={t.anTrend} help={t.anTrendHelp} />
          {data.trend ? (
            <StackedMonths months={data.trend.months} lang={lang} labels={{ approved: t.anApproved, evidence: t.anRfe, denied: t.anDenied }} describe={t.anTrendMonth} />
          ) : (
            <NotEnough text={notEnough} />
          )}
        </Card>
      </FadeInDown>

      <Small style={{ textAlign: "center" }}>{t.insightsNote}</Small>
    </Screen>
  );
}
