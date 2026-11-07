import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { font, radius, space, useTheme } from "../lib/theme";
import type { StatusCategory } from "../lib/api";
import { Icon } from "./icon";
import type { Glyph } from "./feature";

/** Shared building blocks: one look across every screen, light and dark. */

export function Screen({
  children,
  refreshing,
  onRefresh,
  edges,
  tab,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ("top" | "bottom")[];
  /** A tab screen: no navigation header above it, the tab bar below it. */
  tab?: boolean;
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges ?? (tab ? ["top"] : ["bottom"])} style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior={tab ? "automatic" : undefined}
          // The web preview draws its tab bar at the top; phones draw it at the bottom.
          contentContainerStyle={{ padding: space(5), gap: space(4), paddingTop: tab && Platform.OS === "web" ? space(20) : space(5), paddingBottom: tab ? space(28) : space(10) }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={[font.h1, { color: c.heading }, style]}>
      {children}
    </Text>
  );
}
export function H2({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={[font.h2, { color: c.heading }, style]}>
      {children}
    </Text>
  );
}
export function Body({ children, style, muted }: { children: ReactNode; style?: TextStyle; muted?: boolean }) {
  const { c } = useTheme();
  return <Text style={[font.body, { color: muted ? c.muted : c.text, lineHeight: 23 }, style]}>{children}</Text>;
}
export function Small({ children, style, muted = true }: { children: ReactNode; style?: TextStyle; muted?: boolean }) {
  const { c } = useTheme();
  return <Text style={[font.small, { color: muted ? c.muted : c.text, lineHeight: 20 }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg, padding: space(4), gap: space(2) };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { backgroundColor: c.surface2 }, style]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  iconAfter,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  /** Icon before the label (e.g. a plus). */
  icon?: Glyph;
  /** Icon after the label (e.g. an arrow). */
  iconAfter?: Glyph;
}) {
  const { c } = useTheme();
  const primary = variant === "primary";
  const danger = variant === "danger";
  const fg = primary ? c.onAccent : danger ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 16,
        paddingHorizontal: space(5),
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: space(2),
        opacity: disabled ? 0.55 : 1,
        backgroundColor: primary ? (pressed ? c.accentPressed : c.accent) : pressed ? c.surface2 : c.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: danger ? c.danger : c.border,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon ios={icon.ios} md={icon.md} size={18} color={fg} fallback={icon.fallback} /> : null}
      <Text style={{ fontSize: 17, fontWeight: "700", color: fg }}>{title}</Text>
      {iconAfter && !loading ? <Icon ios={iconAfter.ios} md={iconAfter.md} size={18} color={fg} fallback={iconAfter.fallback} /> : null}
    </Pressable>
  );
}

export function Field({ label, error, hint, secure, ...input }: { label: string; error?: string; hint?: string; secure?: boolean } & TextInputProps) {
  const { c } = useTheme();
  const [reveal, setReveal] = useState(false);
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={[font.small, { color: c.text, fontWeight: "600" }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          secureTextEntry={secure && !reveal}
          style={{
            flex: 1,
            // Lets two fields share a row (a web input otherwise keeps its default width).
            minWidth: 0,
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            borderRadius: radius.sm,
            backgroundColor: c.surface,
            color: c.text,
            paddingHorizontal: space(3),
            paddingRight: secure ? 48 : space(3),
            fontSize: 16,
          }}
          {...input}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reveal ? "Hide password" : "Show password"}
            onPress={() => setReveal((v) => !v)}
            style={{ position: "absolute", right: 0, width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{reveal ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
      </View>
      {hint && !error && <Small>{hint}</Small>}
      {error && <Small style={{ color: c.danger }}>{error}</Small>}
    </View>
  );
}

export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "danger" | "plain" }) {
  const { c } = useTheme();
  const map = {
    info: { bg: c.accentSoft, border: c.accent, fg: c.text },
    success: { bg: c.successSoft, border: c.success, fg: c.success },
    danger: { bg: c.dangerSoft, border: c.danger, fg: c.danger },
    plain: { bg: c.surface, border: c.border, fg: c.text },
  }[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={{ backgroundColor: map.bg, borderColor: map.border, borderWidth: 1, borderRadius: radius.md, padding: space(3) }}>
      <Text style={[font.small, { color: map.fg, lineHeight: 20 }]}>{children}</Text>
    </View>
  );
}

export function Pill({ text, tone = "plain" }: { text: string; tone?: "success" | "danger" | "plain" }) {
  const { c } = useTheme();
  const bg = tone === "success" ? c.successSoft : tone === "danger" ? c.dangerSoft : c.surface2;
  const fg = tone === "success" ? c.success : tone === "danger" ? c.danger : c.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: space(1), alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: "row", gap: space(3), alignItems: "flex-start" }}>
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.accent : c.border,
          backgroundColor: checked ? c.accent : c.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Text style={{ color: c.onAccent, fontSize: 14, fontWeight: "800" }}>✓</Text>}
      </View>
      <Text style={[font.small, { color: c.text, flex: 1, lineHeight: 21 }]}>{label}</Text>
    </Pressable>
  );
}

export function Choice({ selected, onPress, title, body }: { selected: boolean; onPress: () => void; title: string; body?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flexDirection: "row", gap: space(3), borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.border, borderRadius: radius.md, padding: space(3), backgroundColor: c.surface }}
    >
      <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 10, borderWidth: 2, borderColor: selected ? c.accent : c.border, alignItems: "center", justifyContent: "center" }}>
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} />}
      </View>
      <View style={{ flex: 1, gap: space(1) }}>
        <Text style={[font.body, { color: c.text, fontWeight: "600" }]}>{title}</Text>
        {body && <Small>{body}</Small>}
      </View>
    </Pressable>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel="CasePingo" style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
      <Image source={require("../../assets/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.24 }} />
      <Text style={{ fontSize: size * 0.58, fontWeight: "800", letterSpacing: -0.3 }}>
        <Text style={{ color: c.heading }}>Case</Text>
        <Text style={{ color: c.brandRed }}>Pingo</Text>
      </Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Small>{label}</Small>
      <Body>{value}</Body>
    </View>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

/** Coloured label for the kind of status (USCIS's wording is shown next to it). */
export function StatusPill({ category, label }: { category: StatusCategory; label: string }) {
  const { c } = useTheme();
  const { fg, bg } = c.st[category];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), backgroundColor: bg, borderRadius: 6, paddingHorizontal: space(2), paddingVertical: space(0.75), alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Vertical timeline, newest first: a coloured dot per status kind joined by a line. */
export function Timeline({ items }: { items: { key: string; title: string; meta?: string; category: StatusCategory }[] }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 0 }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <View key={it.key} style={{ flexDirection: "row", gap: space(3) }}>
            <View style={{ width: 11, alignItems: "center" }}>
              <View style={{ width: 11, height: 11, borderRadius: 6, marginTop: 6, backgroundColor: c.st[it.category].fg }} />
              {!last && <View style={{ flex: 1, width: 1, marginTop: 3, backgroundColor: c.border }} />}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : space(4) }}>
              <Body style={{ fontWeight: i === 0 ? "700" : "500" }}>{it.title}</Body>
              {it.meta ? <Small>{it.meta}</Small> : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}
