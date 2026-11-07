import { useState } from "react";
import { Text, View } from "react-native";
import type { LineMap, LineMapTone } from "../lib/api";
import { formatDay, strings, type Lang } from "../lib/i18n";
import { space, useTheme, type Colors } from "../lib/theme";
import { Icon } from "./icon";

/** The case's tone: the same colors as the status kinds. */
export const toneColors = (c: Colors, tone: LineMapTone) => c.st[tone];

/** The current step in the case's tone ("Evidence requested", "Card mailed"). */
export function StepChip({ map, lang, small }: { map: LineMap; lang: Lang; small?: boolean }) {
  const { c } = useTheme();
  if (!map.marker) return null;
  const tone = toneColors(c, map.tone);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), alignSelf: "flex-start", paddingHorizontal: small ? space(2) : space(2.5), paddingVertical: small ? 3 : 4, borderRadius: 999, backgroundColor: tone.bg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.fg }} />
      <Text style={{ color: tone.fg, fontWeight: "700", fontSize: small ? 12 : 13 }} numberOfLines={1}>
        {map.marker[lang]}
      </Text>
    </View>
  );
}

/** Dots joined by segments; the line darkens toward the current step, which is bigger and ringed. */
function Track({ map, size }: { map: LineMap; size: "small" | "large" }) {
  const { c } = useTheme();
  const fg = toneColors(c, map.tone).fg;
  const dot = size === "large" ? 14 : 9;
  const big = size === "large" ? 24 : 14;
  const bar = size === "large" ? 6 : 3;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: big }}>
      {map.steps.map((s, i) => {
        const reached = s.state !== "upcoming";
        const current = s.state === "current";
        const fade = map.current > 0 ? 0.35 + 0.65 * (i / map.current) : 1;
        return (
          // The first dot sizes to itself (flex: 0 would collapse it on the web and let the next segment cover it).
          <View key={s.key} style={[{ flexDirection: "row", alignItems: "center" }, i > 0 && { flex: 1 }]}>
            {i > 0 && <View style={{ flex: 1, height: bar, borderRadius: bar, backgroundColor: i <= map.current ? fg : c.border, opacity: i <= map.current ? fade : 1 }} />}
            {current ? (
              <View style={{ width: big, height: big, borderRadius: big / 2, backgroundColor: fg, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: big - 8, height: big - 8, borderRadius: big, backgroundColor: fg, borderWidth: size === "large" ? 3 : 2, borderColor: c.surface }} />
              </View>
            ) : (
              <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: reached ? fg : c.surface, opacity: reached ? fade : 1, borderWidth: reached ? 0 : 2, borderColor: c.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** The small line on a case card. */
export function MiniLine({ map, lang }: { map: LineMap; lang: Lang }) {
  const t = strings(lang);
  const label = map.marker?.[lang] ?? "";
  return (
    <View accessible accessibilityLabel={t.lineMapA11y(map.name[lang], map.current + 1, map.steps.length, label)} style={{ maxWidth: 240 }}>
      <Track map={map} size="small" />
    </View>
  );
}

/** The case screen's line map: the marker above the current step, the line, then every step with its date. */
export function LineMapView({ map, lang }: { map: LineMap; lang: Lang }) {
  const { c, isDark } = useTheme();
  const t = strings(lang);
  const fg = toneColors(c, map.tone).fg;
  const [width, setWidth] = useState(0);
  const [pill, setPill] = useState(0);
  const n = map.steps.length;
  const big = 24;
  // Center of the current dot: dots sit at the ends of equal segments.
  const x = n > 1 && map.current >= 0 ? big / 2 + (map.current / (n - 1)) * (width - big) : big / 2;
  const left = Math.min(Math.max(0, x - pill / 2), Math.max(0, width - pill));
  return (
    <View style={{ gap: space(4) }}>
      <View
        accessible
        accessibilityLabel={t.lineMapA11y(map.name[lang], map.current + 1, n, map.marker?.[lang] ?? "")}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ paddingTop: map.marker ? 38 : 0 }}
      >
        {map.marker && width > 0 && (
          <>
            <View onLayout={(e) => setPill(e.nativeEvent.layout.width)} style={{ position: "absolute", top: 0, left, opacity: pill ? 1 : 0 }}>
              <View style={{ backgroundColor: fg, paddingHorizontal: space(2.5), paddingVertical: 5, borderRadius: 6 }}>
                <Text style={{ color: isDark ? c.background : "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }} numberOfLines={1}>
                  {map.marker[lang]}
                </Text>
              </View>
            </View>
            <View style={{ position: "absolute", top: 24, left: x - 1, width: 2, height: 14, backgroundColor: fg }} />
          </>
        )}
        <Track map={map} size="large" />
      </View>
      <View style={{ gap: space(2.5) }}>
        {map.steps.map((s) => {
          const current = s.state === "current";
          const done = s.state === "done";
          return (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: space(2.5) }}>
              {done ? (
                <Icon ios="checkmark.circle.fill" md="check_circle" size={18} color={fg} fallback="✓" />
              ) : current ? (
                <Icon ios="largecircle.fill.circle" md="radio_button_checked" size={18} color={fg} fallback="●" />
              ) : (
                <Icon ios="circle" md="radio_button_unchecked" size={18} color={c.border} fallback="○" />
              )}
              <Text style={{ flex: 1, fontSize: 15, fontWeight: current ? "700" : "500", color: s.state === "upcoming" ? c.muted : current ? c.heading : c.text }}>{s.label[lang]}</Text>
              {s.date && <Text style={{ fontSize: 14, color: current ? fg : c.muted, fontWeight: current ? "700" : "500" }}>{formatDay(s.date, lang)}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}
