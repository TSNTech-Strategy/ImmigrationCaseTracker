import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Card, H2, Loading, Screen, Small } from "../../components/ui";
import { FlagStripe, StarsMark } from "../../components/celebration";
import { IconTile } from "../../components/feature";
import { Icon } from "../../components/icon";
import { FadeInDown, stagger } from "../../components/motion";
import { toneColors } from "../../components/line-map";
import { api, ApiError, type JourneyResponse } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { daysBetween } from "../../lib/days";
import { formatDay } from "../../lib/i18n";
import { font, radius, space, useTheme } from "../../lib/theme";

function Label({ children }: { children: string }) {
  return <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{children}</Small>;
}

function FormChip({ code }: { code: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 6, backgroundColor: c.accentSoft }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: c.accent }}>{code}</Text>
    </View>
  );
}

/** My timeline: every case on one chart (like a Gantt), with total days and the dated steps. */
export default function Journey() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<JourneyResponse>("/api/v1/journey"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data && !error) return <Loading />;
  const start = data?.start ?? null;
  const end = data?.end ?? null;
  const total = data?.totalDays ?? null;
  const cases = data?.cases ?? [];
  const allDone = cases.length > 0 && cases.every((x) => x.finished);
  const span = Math.max(1, total ?? 1);

  return (
    <Screen>
      {error && <Banner tone="danger">{error}</Banner>}

      {data && total === null && (
        <View style={{ alignItems: "center", gap: space(3), paddingVertical: space(8) }}>
          <IconTile glyph={{ ios: "chart.bar.xaxis", md: "timeline", fallback: "▤" }} tint="blue" size={56} />
          <Text style={{ fontSize: 15, color: c.muted, textAlign: "center", lineHeight: 21, maxWidth: 300 }}>{t.journeyEmpty}</Text>
        </View>
      )}

      {allDone && (
        <FadeInDown>
          <View accessibilityRole="summary" style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            <FlagStripe />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), padding: space(4) }}>
              <StarsMark />
              <View style={{ flex: 1, gap: space(1) }}>
                <H2>{t.congratsTitle}</H2>
                <Text style={{ fontSize: 15, color: c.text, lineHeight: 21 }}>{t.journeyDone}</Text>
              </View>
            </View>
          </View>
        </FadeInDown>
      )}

      {start && end && total !== null && (
        <FadeInDown delay={stagger(1, 60)}>
          <Card>
            <View style={{ gap: 2 }}>
              <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>
                {t.journeyTotal(total)}
              </Text>
              <Small>
                {formatDay(start, lang)} – {formatDay(end, lang)}
              </Small>
            </View>

            <View style={{ gap: space(4), marginTop: space(1) }}>
              {cases.map((x) => {
                const tone = toneColors(c, x.tone);
                const left = (daysBetween(start, x.start) / span) * 100;
                const width = Math.max(2, (x.days / span) * 100);
                const status = (lang === "es" ? x.statusTitleEs : x.statusTitleEn) ?? x.statusTitleEn ?? "";
                const office = x.office ? (x.office.name ? `${x.office.name[lang]} (${x.office.code})` : x.office.code) : null;
                return (
                  <Pressable
                    key={x.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.form?.code ?? x.receiptMasked}. ${x.nickname ?? ""} ${t.dayCount(x.days)}. ${status}`}
                    onPress={() => router.push(`/cases/${x.id}`)}
                    style={({ pressed }) => ({ gap: space(1.5), opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                      {x.form ? <FormChip code={x.form.code} /> : <Text style={[font.mono, { fontSize: 13, color: c.muted }]}>{x.receiptMasked}</Text>}
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: c.text }} numberOfLines={1}>
                        {x.nickname ?? (x.form?.name ? x.form.name[lang] : "")}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: tone.fg }}>{t.dayCount(x.days)}</Text>
                      {x.finished && <Icon ios="checkmark.circle.fill" md="check_circle" size={16} color={tone.fg} fallback="✓" />}
                    </View>
                    <View style={{ height: 12, borderRadius: 6, backgroundColor: c.surface2, overflow: "hidden" }}>
                      <View style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, borderRadius: 6, backgroundColor: tone.fg }} />
                    </View>
                    {office && (
                      <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>
                        {office}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Small style={{ fontSize: 12 }}>{formatDay(start, lang)}</Small>
                <Small style={{ fontSize: 12 }}>{formatDay(end, lang)}</Small>
              </View>
            </View>
          </Card>
        </FadeInDown>
      )}

      {data && data.milestones.length > 0 && start && (
        <FadeInDown delay={stagger(2, 60)}>
          <Card>
            <Label>{t.journeyMilestones}</Label>
            <View>
              {data.milestones.map((m, i) => {
                const last = i === data.milestones.length - 1;
                const color = c.st[m.category].fg;
                const title = (lang === "es" ? m.titleEs : m.titleEn) ?? m.titleEn ?? "";
                return (
                  <Pressable
                    key={`${m.caseId}-${m.date}-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDay(m.date, lang)}, ${t.journeyDay(m.day)}. ${m.form ?? ""} ${title}`}
                    onPress={() => router.push(`/cases/${m.caseId}`)}
                    style={({ pressed }) => ({ flexDirection: "row", gap: space(3), opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ width: 14, alignItems: "center" }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginTop: 4 }} />
                      {!last && <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginVertical: 2 }} />}
                    </View>
                    <View style={{ flex: 1, gap: 4, paddingBottom: last ? 0 : space(4) }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                        <Text style={{ flex: 1, fontSize: 13, color: c.muted }}>{formatDay(m.date, lang)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color }}>{t.journeyDay(m.day)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
                        {m.form && <FormChip code={m.form} />}
                        <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: c.heading, lineHeight: 20 }}>{title}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </FadeInDown>
      )}

      {data && total !== null && <Small style={{ textAlign: "center" }}>{t.journeyNote}</Small>}
    </Screen>
  );
}
