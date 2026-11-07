import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { Glyph } from "./feature";
import { IconTile } from "./feature";
import { Icon } from "./icon";
import type { Lang } from "../lib/i18n";
import { space, useTheme } from "../lib/theme";

/**
 * Charts for the case analysis screen (the layout follows Lawfully's Analysis screens, in
 * CasePingo's style). Values are always written as text next to the marks; one category is
 * highlighted at a time (accent) and the rest are gray, so nothing depends on telling many
 * colours apart. The trend uses three colours checked with the data-viz palette validator.
 */

const BAR = 10;
/** Chart text uses the system sans (the web preview would otherwise fall back to a serif). */
const SVG_FONT = Platform.OS === "web" ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : undefined;
const locale = (lang: Lang) => (lang === "es" ? "es-US" : "en-US");
export const monthName = (ym: string, lang: Lang, style: "short" | "long" = "short", withYear = false) =>
  new Intl.DateTimeFormat(locale(lang), { month: style, year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)).replace(".", "");

/** Card header: tinted icon, title, optional subtitle, and a "?" that shows an explanation. */
export function CardHead({ glyph, title, sub, help, right }: { glyph: Glyph; title: string; sub?: string; help?: string; right?: ReactNode }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space(2) }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space(3) }}>
        <IconTile glyph={glyph} tint="blue" size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "700", color: c.heading, lineHeight: 22 }}>
            {title}
          </Text>
          {sub ? <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{sub}</Text> : null}
        </View>
        {help ? (
          <Pressable accessibilityRole="button" accessibilityLabel={help} onPress={() => setOpen((v) => !v)} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: c.muted }}>?</Text>
          </Pressable>
        ) : null}
        {right}
      </View>
      {open && help ? <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19, backgroundColor: c.surface2, padding: space(3), borderRadius: 10 }}>{help}</Text> : null}
    </View>
  );
}

/** Approvals added up day by day: this month (accent, up to today) against all of last month (gray). */
export function MonthlyChart({ m, lang, lastLabel, thisLabel }: { m: { month: string; lastMonth: string; today: number; daysInMonth: number; thisMonth: number[]; last: number[]; thisTotal: number; lastTotal: number }; lang: Lang; lastLabel: string; thisLabel: string }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const H = 150;
  const top = 26;
  const bottom = 12;
  const left = 4;
  const right = 36;
  const days = Math.max(m.daysInMonth, m.last.length);
  const max = Math.max(1, m.lastTotal, m.thisTotal);
  const x = (day: number) => left + ((day - 1) / Math.max(1, days - 1)) * (w - left - right);
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
  const mon = monthName(m.month, lang);
  const n = (v: number) => v.toLocaleString(locale(lang));
  return (
    <View style={{ gap: space(2) }}>
      <View style={{ flexDirection: "row", gap: space(4), flexWrap: "wrap" }}>
        {[
          { color: c.chart.muted, label: lastLabel },
          { color: c.chart.accent, label: thisLabel },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
            <Text style={{ fontSize: 13, color: c.text }}>{l.label}</Text>
          </View>
        ))}
      </View>
      <View
        accessible
        accessibilityLabel={`${thisLabel}: ${n(m.thisTotal)}. ${lastLabel}: ${n(m.lastTotal)}.`}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ height: H }}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            <Rect x={left} y={H - bottom} width={w - left - right} height={1} fill={c.border} />
            <Polyline points={pts(m.last)} fill="none" stroke={c.chart.muted} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Polyline points={pts(m.thisMonth)} fill="none" stroke={c.chart.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* Last month's total in a bubble at the end of its line. */}
            <G>
              <Rect x={x(m.last.length) - 28} y={y(m.lastTotal) - 24} width={40} height={18} rx={5} fill={c.surface2} />
              <SvgText fontFamily={SVG_FONT} x={x(m.last.length) - 8} y={y(m.lastTotal) - 11} fontSize={11} fontWeight="700" fill={c.heading} textAnchor="middle">
                {n(m.lastTotal)}
              </SvgText>
            </G>
            {/* Today: end dot with a surface ring, and this month's total. */}
            <Circle cx={x(m.today)} cy={y(m.thisTotal)} r={6} fill={c.surface} />
            <Circle cx={x(m.today)} cy={y(m.thisTotal)} r={4} fill={c.chart.accent} />
            <SvgText fontFamily={SVG_FONT} x={x(m.today)} y={y(m.thisTotal) - 10} fontSize={11} fontWeight="700" fill={c.heading} textAnchor="middle">
              {n(m.thisTotal)}
            </SvgText>
          </Svg>
        )}
      </View>
      {w > 0 && (
        <View style={{ height: 16 }}>
          {[
            { d: 1, align: "left" as const },
            { d: m.today, align: "center" as const },
            { d: m.daysInMonth, align: "right" as const },
          ]
            .filter((a, i, all) => i === 0 || Math.abs(x(a.d) - x(all[i - 1].d)) > 46)
            .map((a) => (
              <Text
                key={a.d}
                style={{
                  position: "absolute",
                  fontSize: 12,
                  color: a.d === m.today ? c.heading : c.muted,
                  fontWeight: a.d === m.today ? "700" : "400",
                  ...(a.align === "left" ? { left: 0 } : a.align === "right" ? { right: 0 } : { left: x(a.d) - 26, width: 52, textAlign: "center" }),
                }}
              >
                {mon} {a.d}
              </Text>
            ))}
        </View>
      )}
    </View>
  );
}

/** "Your case ranking": four rows of the line map around this case's step, with "You" on its row. */
export function RankingMini({ steps, youLabel }: { steps: { key: string; cases: number; you: boolean }[]; youLabel: string }) {
  const { c } = useTheme();
  const me = Math.max(0, steps.findIndex((s) => s.you));
  const start = Math.max(0, Math.min(me - 1, steps.length - 4));
  const rows = steps.slice(start, start + 4);
  const max = Math.max(1, ...rows.map((r) => r.cases));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 70, height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(6, (r.cases / max) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: r.you ? c.chart.accent : c.chart.muted }} />
          </View>
          {r.you ? (
            <View style={{ backgroundColor: c.chart.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{youLabel}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Values compared with each other, scaled to the largest; one row can be "yours". */
export function EmphasisBars({ rows, youLabel }: { rows: { key: string; label: string; value: number; valueText: string; you?: boolean }[]; youLabel: string }) {
  const { c } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: space(3) }}>
      {rows.map((r) => (
        <View key={r.key} accessible accessibilityLabel={`${r.label}: ${r.valueText}${r.you ? `, ${youLabel}` : ""}`} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            <Text style={{ flexShrink: 1, fontSize: 14, fontWeight: r.you ? "700" : "500", color: r.you ? c.heading : c.text }} numberOfLines={2}>
              {r.label}
            </Text>
            {r.you && (
              <View style={{ backgroundColor: c.chart.accent, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: 1 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{youLabel}</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Text style={{ flexShrink: 0, fontSize: 14, fontWeight: "700", color: c.heading }}>{r.valueText}</Text>
          </View>
          <View style={{ height: BAR, flexDirection: "row" }}>
            {r.value > 0 && (
              <View style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, height: BAR, backgroundColor: r.you ? c.chart.accent : c.chart.muted, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Office times like a table with bars: code on the left, bar, days at the end; this case's office highlighted. */
export function OfficeBars({ rows, youLabel, days }: { rows: { code: string; medianDays: number; yours: boolean }[]; youLabel: string; days: (n: number) => string }) {
  const { c } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.medianDays));
  return (
    <View style={{ gap: space(2.5) }}>
      {rows.map((r) => (
        <View key={r.code} accessible accessibilityLabel={`${r.code}: ${days(r.medianDays)}${r.yours ? `, ${youLabel}` : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <Text style={{ width: 42, fontSize: 14, fontWeight: r.yours ? "800" : "600", color: r.yours ? c.heading : c.text }}>{r.code}</Text>
          <View style={{ flex: 1, height: 22, justifyContent: "center" }}>
            <View style={{ width: `${Math.max(4, (r.medianDays / max) * 100)}%`, height: 14, backgroundColor: r.yours ? c.chart.accent : c.chart.muted, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <Text style={{ width: 74, textAlign: "right", fontSize: 14, fontWeight: "700", color: c.heading }}>{days(r.medianDays)}</Text>
        </View>
      ))}
    </View>
  );
}

const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
function slicePath(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a1);
  const [x2, y2] = polar(cx, cy, r, a1);
  const [x3, y3] = polar(cx, cy, r, a0);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Part-to-whole donut: the picked slice in the accent with its share in a bubble, the rest gray, a label in the middle. */
export function Donut({ slices, picked, center, size = 220 }: { slices: { key: string; label: string; share: number; value: number }[]; picked: string; center: string; size?: number }) {
  const { c } = useTheme();
  const R = size / 2 - 4;
  const r = R * 0.52;
  const cx = size / 2;
  const cy = size / 2;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  // Each slice starts where the ones before it end (from 12 o'clock, clockwise).
  const before = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + s.value, 0));
  const arcs = slices.map((s, i) => {
    const a0 = -Math.PI / 2 + (before[i] / total) * Math.PI * 2;
    return { ...s, a0, a1: a0 + (s.value / total) * Math.PI * 2 };
  });
  const sel = arcs.find((s) => s.key === picked) ?? arcs[0];
  const mid = sel ? (sel.a0 + sel.a1) / 2 : 0;
  const [bx, by] = polar(cx, cy, R * 0.92, mid);
  const bubbleW = 104;
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }} accessible accessibilityLabel={slices.map((s) => `${s.label}: ${s.share}%`).join(", ")}>
      <Svg width={size} height={size}>
        {arcs.length === 1 ? (
          <Circle cx={cx} cy={cy} r={(R + r) / 2} stroke={c.chart.accent} strokeWidth={R - r} fill="none" />
        ) : (
          arcs.map((s) => <Path key={s.key} d={slicePath(cx, cy, R, r, s.a0, s.a1)} fill={s.key === sel?.key ? c.chart.accent : c.chart.muted} stroke={c.surface} strokeWidth={2} />)
        )}
        <SvgText fontFamily={SVG_FONT} x={cx} y={cy + 6} fontSize={17} fontWeight="800" fill={c.heading} textAnchor="middle">
          {center}
        </SvgText>
      </Svg>
      {sel && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.min(Math.max(0, bx - bubbleW / 2), size - bubbleW),
            top: Math.min(Math.max(0, by - 30), size - 60),
            width: bubbleW,
            paddingVertical: 8,
            paddingHorizontal: 6,
            borderRadius: 999,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            shadowColor: "#0F1B2D",
            shadowOpacity: 0.16,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 11, color: c.text }} numberOfLines={1}>
            {sel.label}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: c.heading }}>{sel.share}%</Text>
        </View>
      )}
    </View>
  );
}

/** Legend rows for the donut: tap one to highlight it; the first four show, the rest behind "See more". */
export function DonutLegend({ rows, picked, onPick, seeMore, hide, lang }: { rows: { key: string; label: string; share: number; value: number }[]; picked: string; onPick: (k: string) => void; seeMore: string; hide: string; lang: Lang }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, 4);
  return (
    <View style={{ gap: space(1) }}>
      {shown.map((r) => {
        const on = r.key === picked;
        return (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            aria-selected={on}
            accessibilityLabel={`${r.label}: ${r.share}%, ${r.value}`}
            onPress={() => onPick(r.key)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space(2.5), paddingVertical: space(2), paddingHorizontal: space(1), borderRadius: 8, backgroundColor: pressed ? c.surface2 : "transparent" })}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? c.chart.accent : c.chart.muted }} />
            <Text style={{ fontSize: 16, color: c.heading, fontWeight: on ? "700" : "400" }}>{r.label}</Text>
            <Text style={{ fontSize: 13, color: c.muted }}>{r.share.toLocaleString(locale(lang))}%</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 15, color: c.heading, fontWeight: "600" }}>{r.value.toLocaleString(locale(lang))}</Text>
          </Pressable>
        );
      })}
      {rows.length > 4 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => ({ marginTop: space(2), paddingVertical: space(3), borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: pressed ? c.surface2 : c.accentSoft })}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.heading }}>{open ? hide : seeMore}</Text>
          <Icon ios={open ? "chevron.up" : "chevron.down"} md={open ? "expand_less" : "expand_more"} size={14} color={c.heading} fallback={open ? "▴" : "▾"} />
        </Pressable>
      )}
    </View>
  );
}

/** One ratio as a ring (track in a light step of the same colour), the percentage in the middle and a label above it. */
export function Ring({ value, label, color, track, size = 120 }: { value: number; label: string; color: string; track: string; size?: number }) {
  const { c } = useTheme();
  const stroke = 12;
  const rr = (size - stroke) / 2;
  const circ = 2 * Math.PI * rr;
  return (
    <View accessible accessibilityLabel={`${label}: ${value}%`} style={{ alignItems: "center", gap: space(2), flex: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{label}</Text>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={rr} stroke={track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={rr}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * circ} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <SvgText fontFamily={SVG_FONT} x={size / 2} y={size / 2 + 8} fontSize={24} fontWeight="800" fill={c.heading} textAnchor="middle">
            {`${value}%`}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

/** Approvals, RFEs and denials per month as stacked columns (2px gaps between parts); tap a month to read it. */
export function StackedMonths({
  months,
  lang,
  labels,
  describe,
}: {
  months: { month: string; approved: number; evidence: number; denied: number }[];
  lang: Lang;
  labels: { approved: string; evidence: string; denied: string };
  describe: (month: string, a: number, r: number, d: number) => string;
}) {
  const { c } = useTheme();
  const [picked, setPicked] = useState(months.length - 1);
  const max = Math.max(1, ...months.map((m) => m.approved + m.evidence + m.denied));
  const H = 130;
  const sel = months[picked];
  const parts = (m: (typeof months)[number]) => [
    { key: "denied", v: m.denied, color: c.chart.denied },
    { key: "evidence", v: m.evidence, color: c.chart.evidence },
    { key: "approved", v: m.approved, color: c.chart.approved },
  ];
  return (
    <View style={{ gap: space(2) }}>
      <View style={{ flexDirection: "row", gap: space(4), flexWrap: "wrap" }}>
        {[
          { color: c.chart.approved, label: labels.approved },
          { color: c.chart.evidence, label: labels.evidence },
          { color: c.chart.denied, label: labels.denied },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: l.color }} />
            <Text style={{ fontSize: 13, color: c.text }}>{l.label}</Text>
          </View>
        ))}
      </View>
      {sel && <Text style={{ fontSize: 14, color: c.heading, fontWeight: "600" }}>{describe(monthName(sel.month, lang, "long", true), sel.approved, sel.evidence, sel.denied)}</Text>}
      <View style={{ height: H, flexDirection: "row", alignItems: "flex-end", gap: 3, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={describe(monthName(m.month, lang, "long", true), m.approved, m.evidence, m.denied)}
            onPress={() => setPicked(i)}
            style={{ flex: 1, height: H, justifyContent: "flex-end", alignItems: "center", opacity: i === picked ? 1 : 0.75 }}
          >
            <View style={{ width: "72%", maxWidth: 24, gap: 2 }}>
              {parts(m)
                .filter((p) => p.v > 0)
                .map((p, j) => (
                  <View key={p.key} style={{ height: Math.max(2, (p.v / max) * (H - 6)), backgroundColor: p.color, borderTopLeftRadius: j === 0 ? 4 : 0, borderTopRightRadius: j === 0 ? 4 : 0 }} />
                ))}
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {months.map((m, i) => (
          <Text key={m.month} style={{ flex: 1, textAlign: "center", fontSize: 10, color: i === picked ? c.heading : c.muted, fontWeight: i === picked ? "700" : "400" }} numberOfLines={1}>
            {monthName(m.month, lang)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** "Not enough cases yet" in place of a chart. */
export function NotEnough({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space(2), alignItems: "flex-start", padding: space(3), borderRadius: 10, backgroundColor: c.surface2 }}>
      <Icon ios="hourglass" md="hourglass_empty" size={16} color={c.muted} fallback="…" />
      <Text style={{ flex: 1, fontSize: 14, color: c.muted, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}
