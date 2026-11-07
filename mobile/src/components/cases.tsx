import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from "react-native";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import type { CaseSummary, StatusCategory } from "../lib/api";
import type { Lang } from "../lib/i18n";
import { formatDay, shortDate, strings, timeAgo } from "../lib/i18n";
import { font, radius, space, useTheme } from "../lib/theme";
import { Icon } from "./icon";
import { Pulse } from "./motion";

import { CardTags } from "./tags";
import { router } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { ShareJourneyButton } from "./my-cases";
import { MiniLine, StepChip } from "./line-map";

/** Big screen title with an optional line under it and round action buttons on the right. */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(1), marginTop: space(1) }}>
      {right && <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space(2), minHeight: 44 }}>{right}</View>}
      <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: "800", letterSpacing: -0.6, color: c.heading }}>
        {title}
      </Text>
      {subtitle ? <Text style={{ fontSize: 14, color: c.muted }}>{subtitle}</Text> : null}
    </View>
  );
}

/** Round icon button (44 pt touch target). `filled` uses the brand blue. */
export function IconButton({
  ios,
  md,
  label,
  onPress,
  filled,
  loading,
  fallback,
}: {
  ios: SFSymbol;
  md: AndroidSymbol;
  label: string;
  onPress: () => void;
  filled?: boolean;
  loading?: boolean;
  fallback?: string;
}) {
  const { c } = useTheme();
  const fg = filled ? c.onAccent : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(loading) }}
      disabled={loading}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? (pressed ? c.accentPressed : c.accent) : pressed ? c.surface2 : c.surface,
        borderWidth: filled ? 0 : StyleSheet.hairlineWidth * 2,
        borderColor: c.border,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Icon ios={ios} md={md} size={filled ? 22 : 20} color={fg} fallback={fallback} />}
    </Pressable>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), backgroundColor: c.surface2, borderRadius: radius.md, paddingHorizontal: space(3), minHeight: 44 }}>
      <Icon ios="magnifyingglass" md="search" size={18} color={c.muted} fallback="⌕" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{ flex: 1, fontSize: 16, color: c.text, paddingVertical: space(2.5) }}
      />
    </View>
  );
}

/** Horizontal filter chips, e.g. All 3 · In progress 2 · Approved 1. */
export function FilterChips<T extends string>({ options, value, onChange }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  // When the choice is made elsewhere (e.g. the country someone follows), bring that chip into view.
  // A chip that was just tapped is already in view, so the row doesn't jump.
  const scroller = useRef<ScrollViewInstance>(null);
  const tapped = useRef<T | null>(null);
  const [xs, setXs] = useState<Partial<Record<string, number>>>({});
  const x = xs[value];
  useEffect(() => {
    if (x === undefined) return;
    if (tapped.current === value) tapped.current = null;
    else scroller.current?.scrollTo({ x: Math.max(0, x - space(4)), animated: true });
  }, [x, value]);
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onLayout={(e) => {
              const lx = e.nativeEvent.layout.x;
              setXs((m) => (m[o.key] === lx ? m : { ...m, [o.key]: lx }));
            }}
            onPress={() => {
              tapped.current = o.key;
              onChange(o.key);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space(1.5),
              paddingHorizontal: space(3),
              minHeight: 36,
              borderRadius: 18,
              backgroundColor: on ? c.heading : c.surface,
              borderWidth: on ? 0 : StyleSheet.hairlineWidth * 2,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: on ? c.background : c.text, fontWeight: "600", fontSize: 14 }}>{o.label}</Text>
            {o.count !== undefined && <Text style={{ color: on ? c.background : c.muted, fontSize: 13, fontWeight: "600" }}>{o.count}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Four-step progress line: Received → In review → Decision → After the decision. */
export function Stepper({ stage, total, category, label }: { stage: number; total: number; category: StatusCategory; label?: string }) {
  const { c } = useTheme();
  const color = c.st[category === "none" ? "progress" : category].fg;
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, maxWidth: 180 }}>
        {Array.from({ length: total }, (_, i) => {
          const reached = i <= stage;
          const current = i === stage;
          return (
            // The first dot sizes to itself (flex: 0 would collapse it on the web and let the next line cover it).
            <View key={i} style={[{ flexDirection: "row", alignItems: "center" }, i > 0 && { flex: 1 }]}>
              {i > 0 && <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= stage ? color : c.border }} />}
              <View
                style={{
                  width: current ? 12 : 9,
                  height: current ? 12 : 9,
                  borderRadius: 6,
                  backgroundColor: reached ? color : c.surface,
                  borderWidth: reached ? 0 : 2,
                  borderColor: c.border,
                }}
              />
            </View>
          );
        })}
      </View>
      {label ? <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted, flexShrink: 1 }} numberOfLines={1}>{label.split(": ").pop()}</Text> : null}
    </View>
  );
}

/**
 * Title without repeating the receipt: nickname, else the form, else the receipt.
 * The line under it: codes in monospace (`mono`), a form name in normal text (`text`).
 */
export function caseTitles(cs: Pick<CaseSummary, "nickname" | "receiptMasked" | "formType" | "form">, lang: Lang) {
  const t = strings(lang);
  const code = cs.form?.code ?? cs.formType;
  const line = (mono: string, text?: string) => ({ mono, text, sub: text ? `${mono} · ${text}` : mono });
  if (cs.nickname) return { title: cs.nickname, ...line(code ? `${code} · ${cs.receiptMasked}` : cs.receiptMasked) };
  if (code) return { title: `${t.form} ${code}`, ...line(cs.receiptMasked, cs.form?.name?.[lang]) };
  return { title: cs.receiptMasked, mono: null, text: undefined, sub: null };
}

/** The grey line under a case title: receipt in monospace, form name in normal text. */
export function CaseSubline({ mono, text }: { mono: string | null; text?: string }) {
  const { c } = useTheme();
  if (!mono) return null;
  return (
    <Text style={{ fontSize: 13, color: c.muted }} numberOfLines={1}>
      <Text style={font.mono}>{mono}</Text>
      {text ? ` · ${text}` : ""}
    </Text>
  );
}

/** A placeholder shaped like a case card, shown while the list loads (never an empty state). */
export function CaseCardSkeleton({ label }: { label?: string }) {
  const { c, isDark } = useTheme();
  // Visible on the card in both themes (the dark card is close to surface2).
  const fill = isDark ? c.border : c.surface2;
  const bar = (width: `${number}%` | number, height = 12) => <View style={{ width, height, borderRadius: height / 2, backgroundColor: fill }} />;
  return (
    <Pulse>
      <View
        accessible
        accessibilityLabel={label}
        style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}
      >
        <View style={{ width: 4, backgroundColor: fill }} />
        <View style={{ flex: 1, padding: space(4), gap: space(2.5) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {bar("45%", 16)}
            {bar(64, 20)}
          </View>
          {bar("60%")}
          {bar("70%", 14)}
          <View style={{ flexDirection: "row", gap: space(1.5), marginTop: space(1) }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: fill }} />
            ))}
          </View>
          {bar("40%", 10)}
        </View>
      </View>
    </Pulse>
  );
}

/** "30%" in a ring: how many of the checklist's required documents are ticked. */
function ReadyRing({ pct, size = 38 }: { pct: number; size?: number }) {
  const { c } = useTheme();
  const stroke = 4;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const color = pct >= 100 ? c.st.done.fg : pct > 0 ? c.accent : c.st.stop.fg;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(len * Math.min(pct, 100)) / 100} ${len}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {pct === 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeOpacity={0.6} />}
      </Svg>
      <Text style={{ fontSize: 10, fontWeight: "800", color: c.heading }}>{pct}%</Text>
    </View>
  );
}

/** A case in the list: coloured edge by kind of status, progress line, last change, "New" badge. */
export function CaseCard({ cs, stageCount, isNew, lang, onPress }: { cs: CaseSummary; stageCount: number; isNew: boolean; lang: Lang; onPress: () => void }) {
  const { c } = useTheme();
  const t = strings(lang);
  const names = caseTitles(cs, lang);
  const status = (lang === "es" ? cs.statusTitleEs : cs.statusTitleEn) ?? cs.statusTitleEn ?? t.notChecked;
  const edge = c.st[cs.category].fg;
  const paused = cs.pausedReason === "plan_limit";
  const map = cs.lineMap;
  const code = cs.form?.code ?? cs.formType;
  // The status date USCIS reports, else when CasePingo saw the change.
  const updated = cs.days?.lastUpdate ? formatDay(cs.days.lastUpdate, lang) : cs.lastChangeObservedAt ? shortDate(cs.lastChangeObservedAt, lang) : null;
  const stepLabel = cs.stage !== null ? t.stepOf(cs.stage + 1, stageCount, t.stages[cs.stage] ?? "") : undefined;
  const approved = map?.outcome === "approved";
  // Documents ready for cases still in progress (a finished case doesn't need them any more).
  const readyPct = cs.checklist && cs.checklist.required > 0 && !map?.finished && !approved ? Math.round((cs.checklist.requiredDone / cs.checklist.required) * 100) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${names.title}. ${status}.${map?.marker ? ` ${map.marker[lang]}.` : ""}${cs.nextStep ? ` ${t.nextStep}: ${cs.nextStep[lang]}.` : ""}${isNew ? ` ${t.newBadge}.` : ""}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        backgroundColor: pressed ? c.surface2 : c.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: c.border,
        overflow: "hidden",
      })}
    >
      <View style={{ width: 4, backgroundColor: edge }} />
      <View style={{ flex: 1, padding: space(4), gap: space(2) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <Text style={[font.mono, { flex: 1, fontSize: 14, color: c.muted }]} numberOfLines={1}>
            {cs.receiptMasked}
          </Text>
          {code ? (
            <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 6, backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: c.heading }}>{code}</Text>
            </View>
          ) : null}
        </View>
        {cs.nickname ? (
          <Text style={{ fontSize: 17, fontWeight: "800", color: c.heading }} numberOfLines={1}>
            {cs.nickname}
          </Text>
        ) : null}
        <Text style={{ fontSize: cs.nickname ? 16 : 17, fontWeight: cs.nickname ? "600" : "700", color: cs.nickname ? c.text : c.heading, lineHeight: 22 }}>{status}</Text>
        {map && map.current >= 0 ? <MiniLine map={map} lang={lang} /> : cs.stage !== null ? <Stepper stage={cs.stage} total={stageCount} category={cs.category} label={stepLabel} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          {map?.marker ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: c.muted, textTransform: "uppercase" }}>{t.stepLabel}</Text>
              <StepChip map={map} lang={lang} small />
            </>
          ) : null}
          <Text style={{ flex: 1, textAlign: "right", fontSize: 13, color: c.muted }} numberOfLines={1}>
            {updated ?? (cs.lastCheckedAt ? t.checkedShort(timeAgo(cs.lastCheckedAt, lang)) : "")}
          </Text>
        </View>
        {cs.nextStep ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), paddingHorizontal: space(2.5), paddingVertical: space(2), borderRadius: 10, backgroundColor: c.surface2 }}>
            <Icon ios="arrow.turn.down.right" md="subdirectory_arrow_right" size={14} color={c.accent} fallback="→" />
            <Text style={{ flex: 1, fontSize: 14, color: c.text, lineHeight: 19 }} numberOfLines={2}>
              <Text style={{ fontWeight: "700", color: c.heading }}>{t.nextStep}: </Text>
              {cs.nextStep[lang]}
            </Text>
            {readyPct !== null && cs.checklist && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.checklistDocsFor(code ?? "")}: ${t.docsReady(readyPct)}`}
                onPress={() => router.push(`/checklists/${cs.checklist!.key}`)}
                hitSlop={6}
                style={{ alignItems: "center", gap: 2 }}
              >
                <ReadyRing pct={readyPct} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: c.muted }}>{t.docsLabel}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
        {approved && <ShareJourneyButton caseId={cs.id} lang={lang} compact />}
        {(cs.tags?.length || isNew) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            <View style={{ flex: 1 }}>
              <CardTags tags={cs.tags ?? []} />
            </View>
            {isNew && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(1) }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandRed }} />
                <Text style={{ color: c.brandRed, fontWeight: "700", fontSize: 13 }}>{t.newBadge}</Text>
              </View>
            )}
          </View>
        )}
        {paused && <Text style={{ color: c.danger, fontWeight: "600", fontSize: 13 }}>{t.pausedPlan}</Text>}
      </View>
    </Pressable>
  );
}
