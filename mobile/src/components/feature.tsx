import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import type { Lang } from "../lib/i18n";
import { radius, space, useTheme, type Colors } from "../lib/theme";
import { Icon } from "./icon";
import { DropIn, useHighlight } from "./motion";

export type Tint = "blue" | "green" | "amber" | "red" | "navy";
export type Glyph = { ios: SFSymbol; md: AndroidSymbol; fallback?: string };

export function tintColors(c: Colors, tint: Tint) {
  if (tint === "navy") return { fg: c.heading, bg: c.surface2 };
  const key = { blue: "progress", green: "done", amber: "action", red: "stop" } as const;
  return c.st[key[tint]];
}

/**
 * Rounded tile with an icon on a soft tint. `drop` makes the icon fall in after
 * that many ms. `lit` (0–1) fades in a solid fill with a contrasting icon.
 */
export function IconTile({ glyph, tint, size = 48, round, drop, lit }: { glyph: Glyph; tint: Tint; size?: number; round?: boolean; drop?: number; lit?: Animated.Value }) {
  const { c } = useTheme();
  const { fg, bg } = tintColors(c, tint);
  const iconSize = size * 0.46;
  const icon = <Icon ios={glyph.ios} md={glyph.md} size={iconSize} color={fg} fallback={glyph.fallback} />;
  const corner = round ? size / 2 : size * 0.3;
  return (
    <View style={{ width: size, height: size, borderRadius: corner, backgroundColor: bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {drop !== undefined ? <DropIn delay={drop}>{icon}</DropIn> : icon}
      {lit && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fg, alignItems: "center", justifyContent: "center", opacity: lit }]}>
          {/* surface colour keeps contrast in both themes: white on the light theme, dark navy on the dark one */}
          <Icon ios={glyph.ios} md={glyph.md} size={iconSize} color={c.surface} fallback={glyph.fallback} />
        </Animated.View>
      )}
    </View>
  );
}

/** Icon + title + one line of text, no card around it (used inside a card). `active` lights the icon. */
export function FeatureRow({ glyph, tint, title, text, drop, active = false }: { glyph: Glyph; tint: Tint; title: string; text: string; drop?: number; active?: boolean }) {
  const { c } = useTheme();
  const lit = useHighlight(active);
  return (
    <View testID={active ? "feature-active" : "feature"} style={{ flexDirection: "row", alignItems: "center", gap: space(4) }}>
      <Animated.View style={{ transform: [{ scale: lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <IconTile glyph={glyph} tint={tint} size={48} round drop={drop} lit={lit} />
      </Animated.View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{title}</Text>
        <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{text}</Text>
      </View>
    </View>
  );
}

/** A feature on its own card (welcome screen). `active` lifts the card and lights its icon. */
export function FeatureCard({ glyph, tint, title, text, drop, active = false }: { glyph: Glyph; tint: Tint; title: string; text: string; drop?: number; active?: boolean }) {
  const { c, isDark } = useTheme();
  const lit = useHighlight(active);
  const corner = radius.lg + 4;
  return (
    <Animated.View testID={active ? "feature-active" : "feature"} style={{ transform: [{ scale: lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }}>
      {/* soft shadow under the lit card */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: corner,
            backgroundColor: c.surface,
            opacity: lit,
            shadowColor: "#0A2345",
            shadowOpacity: isDark ? 0.5 : 0.14,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: Platform.OS === "android" ? 6 : 0,
          },
        ]}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space(4),
          padding: space(4),
          backgroundColor: c.surface,
          borderRadius: corner,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: c.border,
        }}
      >
        <IconTile glyph={glyph} tint={tint} size={52} drop={drop} lit={lit} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: c.heading }}>{title}</Text>
          <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{text}</Text>
        </View>
      </View>
      {/* brand-blue outline on the lit card */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: corner, borderWidth: 1.5, borderColor: c.accent, opacity: lit }]} />
    </Animated.View>
  );
}

/** A headline in two colours: the first line in navy, the second in brand blue. */
export function TwoToneTitle({ first, second, size = 34, center }: { first: string; second: string; size?: number; center?: boolean }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontSize: size, lineHeight: size * 1.15, fontWeight: "800", letterSpacing: -0.6, color: c.heading, textAlign: center ? "center" : "left" }}>
      {first}
      {"\n"}
      <Text style={{ color: c.accent }}>{second}</Text>
    </Text>
  );
}

/** English / Español switch. */
export function LangSwitch({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  const { c } = useTheme();
  const opt = (l: Lang, label: string) => {
    const on = value === l;
    return (
      <Pressable
        key={l}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        onPress={() => onChange(l)}
        style={{ paddingHorizontal: space(3), minHeight: 34, justifyContent: "center", borderRadius: 17, backgroundColor: on ? c.accent : "transparent" }}
      >
        <Text style={{ color: on ? c.onAccent : c.text, fontWeight: "700", fontSize: 14 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", alignItems: "center", gap: space(1), padding: space(1), paddingLeft: space(2.5), borderRadius: 22, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border }}
    >
      <Icon ios="globe" md="translate" size={16} color={c.accent} fallback="文" />
      {opt("en", "English")}
      {opt("es", "Español")}
    </View>
  );
}
