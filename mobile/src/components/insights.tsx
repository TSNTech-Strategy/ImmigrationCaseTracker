import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Lang } from "../lib/i18n";
import { space, useTheme } from "../lib/theme";
import { Icon } from "./icon";

/**
 * Small, quiet charts for Case insights. Bars are thin (10px) with a rounded data end and
 * grow from the left; values are always written beside them in text colours, so nothing
 * depends on colour alone. One hue for ranked bars; "your" bar in the accent and the rest
 * in gray when one row is the point.
 */

const BAR = 10;

/** A short label for "your row" (white on the accent, the one place text sits on a colour). */
function YouChip({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.chart.accent, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: 1 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{text}</Text>
    </View>
  );
}

/** Ranked shares out of 100%: label and value on one line, the bar under it on a light track. */
export function ShareBars({ rows }: { rows: { key: string; label: string; share: number; sub?: string }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(3) }}>
      {rows.map((r) => (
        <View key={r.key} accessible accessibilityLabel={`${r.label}: ${r.share}%${r.sub ? `, ${r.sub}` : ""}`} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(2) }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: c.heading }}>{r.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{r.share}%</Text>
          </View>
          <View style={{ height: BAR, borderRadius: 4, backgroundColor: c.surface2, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(1, r.share)}%`, height: BAR, backgroundColor: c.chart.accent, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          {r.sub ? <Text style={{ fontSize: 13, color: c.muted }}>{r.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Values compared with each other (cases per step, days per office), scaled to the largest; one row can be "yours". */
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
            {r.you && <YouChip text={youLabel} />}
            <View style={{ flex: 1 }} />
            <Text style={{ flexShrink: 0, fontSize: 14, fontWeight: "700", color: c.heading }}>{r.valueText}</Text>
          </View>
          <View style={{ height: BAR, flexDirection: "row" }}>
            {r.value > 0 && (
              <View
                style={{
                  width: `${Math.max(2, (r.value / max) * 100)}%`,
                  height: BAR,
                  backgroundColor: r.you ? c.chart.accent : c.chart.muted,
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                }}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** One ratio against 100%: status colour fill on a lighter track, with an icon and words (never colour alone). */
export function Meter({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: "done" | "action" }) {
  const { c } = useTheme();
  const t = c.st[tone];
  return (
    <View accessible accessibilityLabel={`${label}: ${value}%, ${sub}`} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
        {tone === "done" ? (
          <Icon ios="checkmark.circle.fill" md="check_circle" size={16} color={t.fg} fallback="✓" />
        ) : (
          <Icon ios="exclamationmark.circle.fill" md="error" size={16} color={t.fg} fallback="!" />
        )}
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: c.heading }}>{label}</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: c.heading }}>{value}%</Text>
      </View>
      <View style={{ height: BAR, borderRadius: 999, backgroundColor: t.bg, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(1, value)}%`, height: BAR, borderRadius: 999, backgroundColor: t.fg }} />
      </View>
      <Text style={{ fontSize: 13, color: c.muted }}>{sub}</Text>
    </View>
  );
}

/** A number with its label (proportional figures, same font as everything else). */
export function StatTile({ label, value, sub, compact }: { label: string; value: string; sub?: string; /** Smaller figure, for dates. */ compact?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ""}`} style={{ flex: 1, gap: 2, padding: space(3), borderRadius: 12, backgroundColor: c.surface2 }}>
      <Text style={{ fontSize: 13, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: compact ? 20 : 26, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 12, color: c.muted }}>{sub}</Text> : null}
    </View>
  );
}

/** Approvals per month: one series of columns; tap a month to read it (the latest is shown first). */
export function MonthColumns({ months, lang }: { months: { month: string; approvals: number }[]; lang: Lang }) {
  const { c } = useTheme();
  const [picked, setPicked] = useState(months.length - 1);
  const max = Math.max(1, ...months.map((m) => m.approvals));
  const name = (m: string, style: "short" | "long") =>
    new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const sel = months[picked];
  const H = 110;
  return (
    <View
      accessible
      accessibilityLabel={months.map((m) => `${name(m.month, "long")}: ${m.approvals}`).join(", ")}
      style={{ gap: space(2) }}
    >
      <Text style={{ fontSize: 14, color: c.muted }}>
        {sel ? (
          <>
            <Text style={{ fontWeight: "700", color: c.heading }}>{name(sel.month, "long")}</Text>: {sel.approvals.toLocaleString(lang === "es" ? "es-US" : "en-US")}
          </>
        ) : null}
      </Text>
      <View style={{ height: H, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={`${name(m.month, "long")}: ${m.approvals}`}
            onPress={() => setPicked(i)}
            hitSlop={4}
            style={{ flex: 1, height: H, justifyContent: "flex-end", alignItems: "center" }}
          >
            {m.approvals > 0 && (
              <View
                style={{
                  width: "70%",
                  maxWidth: 24,
                  height: Math.max(3, (m.approvals / max) * (H - 8)),
                  backgroundColor: i === picked ? c.chart.accent : c.chart.muted,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            )}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {months.map((m, i) => (
          <Text key={m.month} style={{ flex: 1, textAlign: "center", fontSize: 10, color: i === picked ? c.heading : c.muted, fontWeight: i === picked ? "700" : "400" }} numberOfLines={1}>
            {name(m.month, "short").replace(".", "")}
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
