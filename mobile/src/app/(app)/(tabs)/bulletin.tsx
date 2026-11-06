import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Loading, Screen, Small } from "../../../components/ui";
import { FilterChips, LargeHeader } from "../../../components/cases";
import { TwoToneTitle } from "../../../components/feature";
import { FadeInDown, stagger } from "../../../components/motion";
import { api, ApiError, bulletinChartKey, type BulletinArea, type BulletinCell, type BulletinResponse } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { radius, space, useTheme } from "../../../lib/theme";
import { useRefreshOnForeground } from "../../../lib/use-refresh";

type Kind = "family" | "employment";
type ChartType = "final" | "filing";

/** Two or three options side by side (one selected). */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: on ? c.surface : "transparent", borderWidth: on ? StyleSheet.hairlineWidth * 2 : 0, borderColor: c.border }}
          >
            <Text style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: on ? c.heading : c.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Moved ahead 3 months" in green, "Moved back…" in red, "No change" in grey (left out with onlyChanges). */
function Move({ cell, lang, onlyChanges }: { cell: BulletinCell | undefined; lang: "en" | "es"; onlyChanges?: boolean }) {
  const { c } = useTheme();
  if (!cell?.move || (onlyChanges && !cell.move.changed)) return null;
  const color = cell.move.tone === "good" ? c.success : cell.move.tone === "bad" ? c.danger : c.muted;
  const arrow = cell.move.tone === "good" ? "▲ " : cell.move.tone === "bad" ? "▼ " : "";
  return <Text style={{ fontSize: 12, fontWeight: "600", color }}>{arrow + cell.move[lang]}</Text>;
}

export default function BulletinTab() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<BulletinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState<Kind>("family");
  const [type, setType] = useState<ChartType>("final");
  const [area, setArea] = useState<BulletinArea>("ALL");
  const followed = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<BulletinResponse>("/api/v1/visa-bulletin");
      setData(r);
      setError(null);
      // Open the chart on the person's own category (again whenever they change it).
      const key = r.watch ? `${r.watch.category}:${r.watch.area}:${r.watch.chart}` : null;
      if (r.watch && key !== followed.current) {
        const info = r.catalog.categories.find((x) => x.key === r.watch!.category);
        if (info) setKind(info.kind);
        setArea(r.watch.area);
        setType(r.watch.chart);
      }
      followed.current = key;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useRefreshOnForeground(load);

  if (!data && !error) return <Loading />;
  const b = data?.bulletin ?? null;
  const watch = data?.watch ?? null;
  const watchInfo = watch ? data?.catalog.categories.find((x) => x.key === watch.category) : null;
  const rows = b?.rows[bulletinChartKey(kind, type)] ?? [];
  const areaLabel = (a: BulletinArea) => data?.catalog.areas.find((x) => x.key === a)?.[lang] ?? a;
  const prevLabel = b?.previousMonth ? new Date(`${b.previousMonth}-15T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : null;

  return (
    <Screen
      tab
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <LargeHeader title={t.bulletinTitle} subtitle={b ? t.bulletinFrom(b.label[lang]) : undefined} />
      {error && <Banner tone="danger">{error}</Banner>}
      {data && !b && <Banner tone="plain">{t.bulletinNotLoaded}</Banner>}

      {data && b && watch && watchInfo ? (
        <FadeInDown>
          <Card style={{ padding: space(5), gap: space(3), borderRadius: radius.lg + 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{t.yourCategory}</Small>
              <Pressable accessibilityRole="button" onPress={() => router.push("/bulletin/watch")} hitSlop={8}>
                <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{t.change}</Text>
              </Pressable>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>{watchInfo.code}</Text>
              <Body muted>{watchInfo[lang]}</Body>
              <Small>{areaLabel(watch.area)}</Small>
            </View>
            {(["final", "filing"] as const).map((ty) => {
              const cell = b.rows[bulletinChartKey(watchInfo.kind, ty)]?.find((r) => r.category === watch.category)?.cells[watch.area];
              const first = ty === watch.chart;
              return (
                <View key={ty} style={{ backgroundColor: first ? c.accentSoft : c.surface2, borderRadius: 12, padding: space(3), gap: 2 }}>
                  <Small>{ty === "final" ? t.finalAction : t.dateForFiling}</Small>
                  <Text style={{ fontSize: first ? 22 : 18, fontWeight: "800", color: c.heading }}>{cell ? cell.value[lang] : "—"}</Text>
                  <Move cell={cell} lang={lang} />
                </View>
              );
            })}
            <Small>{data.alerts ? t.bulletinAlertsOn : t.bulletinAlertsPremium}</Small>
          </Card>
        </FadeInDown>
      ) : data && b ? (
        <FadeInDown>
          <Card style={{ padding: space(5), gap: space(3), borderRadius: radius.lg + 6 }}>
            <TwoToneTitle first={t.trackFirst} second={t.trackSecond} size={26} />
            <Body muted>{t.trackBody}</Body>
            <Button title={t.chooseCategory} onPress={() => router.push("/bulletin/watch")} icon={{ ios: "plus", md: "add", fallback: "+" }} />
          </Card>
        </FadeInDown>
      ) : null}

      {b && (
        <>
          <Segmented<Kind> value={kind} onChange={setKind} options={[{ key: "family", label: t.family }, { key: "employment", label: t.employment }]} />
          <Segmented<ChartType> value={type} onChange={setType} options={[{ key: "final", label: t.finalShort }, { key: "filing", label: t.filingShort }]} />
          <FilterChips value={area} onChange={setArea} options={(data?.catalog.areas ?? []).map((a) => ({ key: a.key, label: a[lang] }))} />
          {prevLabel && <Small>{t.comparedWith(prevLabel)}</Small>}
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            {rows.map((r, i) => {
              const cell = r.cells[area];
              const mine = watch?.category === r.category && watch.area === area;
              return (
                <FadeInDown key={`${kind}-${type}-${r.category}`} delay={stagger(i, 40)}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space(3),
                      paddingHorizontal: space(4),
                      paddingVertical: space(3),
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                      backgroundColor: mine ? c.accentSoft : c.surface,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{r.code}</Text>
                      <Text style={{ fontSize: 13, color: c.muted }} numberOfLines={1}>
                        {r[lang]}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: c.text, fontVariant: ["tabular-nums"] }}>{cell ? cell.value[lang] : "—"}</Text>
                      <Move cell={cell} lang={lang} onlyChanges />
                    </View>
                  </View>
                </FadeInDown>
              );
            })}
          </View>
          <Small>{t.bulletinExplain}</Small>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(4) }}>
            <Pressable accessibilityRole="link" onPress={() => data && WebBrowser.openBrowserAsync(data.links.bulletin)} hitSlop={6}>
              <Text style={{ color: c.accent, fontWeight: "600" }}>{t.officialBulletin} ↗</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => data && WebBrowser.openBrowserAsync(data.links.uscisCharts)} hitSlop={6}>
              <Text style={{ color: c.accent, fontWeight: "600" }}>{t.uscisWhichChart} ↗</Text>
            </Pressable>
          </View>
        </>
      )}
      <Small style={{ textAlign: "center" }}>{t.bulletinDisclaimer}</Small>
    </Screen>
  );
}
