import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { type CourtCase, daysUntil, formatANumber, hearingDate, maskANumber } from "../lib/court-cases";
import { type Lang, strings } from "../lib/i18n";
import { font, radius, space, useTheme } from "../lib/theme";
import { IconTile } from "./feature";
import { Icon } from "./icon";
import { Banner, Small } from "./ui";

const EOIR_CASE_INFO_URL = "https://acis.eoir.justice.gov/en/";

function CourtCaseCard({ cs, lang, onCopied }: { cs: CourtCase; lang: Lang; onCopied: () => void }) {
  const { c } = useTheme();
  const t = strings(lang);
  const [shown, setShown] = useState(false);
  const days = cs.hearingAt ? daysUntil(cs.hearingAt) : null;
  const when = cs.hearingAt
    ? hearingDate(cs.hearingAt).toLocaleString(lang === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const soon = days !== null && days >= 0 && days <= 7;
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, padding: space(4), gap: space(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <IconTile glyph={{ ios: "building.columns", md: "account_balance", fallback: "⚖" }} tint="navy" size={42} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: c.heading }}>{cs.court ?? t.courtAddTitle}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            <Text style={[font.mono, { fontSize: 14, color: c.muted }]}>{shown ? formatANumber(cs.aNumber) : maskANumber(cs.aNumber)}</Text>
            <Pressable accessibilityRole="button" onPress={() => setShown((v) => !v)} hitSlop={8}>
              <Text style={{ color: c.accent, fontWeight: "600", fontSize: 13 }}>{shown ? t.courtHide : t.courtShow}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.courtEdit} onPress={() => router.push(`/court/${cs.id}`)} hitSlop={8}>
          <Icon ios="pencil" md="edit" size={18} color={c.accent} fallback="✎" />
        </Pressable>
      </View>

      <View style={{ borderRadius: 10, backgroundColor: soon ? c.st.action.bg : c.surface2, padding: space(3), gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted }}>{t.courtNext}</Text>
        {when && days !== null ? (
          <>
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{when}</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: days < 0 ? c.danger : soon ? c.st.action.fg : c.accent }}>{days < 0 ? t.courtPast : t.courtIn(days)}</Text>
          </>
        ) : (
          <Text style={{ fontSize: 15, color: c.text }}>{t.courtNoHearing}</Text>
        )}
      </View>
      {Platform.OS !== "web" && cs.hearingAt && days !== null && days >= 0 && <Small style={{ fontSize: 12 }}>{cs.reminderIds.length ? t.courtRemindersOn : t.courtRemindersOff}</Small>}

      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await Clipboard.setStringAsync(formatANumber(cs.aNumber));
          onCopied();
          await WebBrowser.openBrowserAsync(EOIR_CASE_INFO_URL);
        }}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2), minHeight: 46, borderRadius: radius.md, backgroundColor: pressed ? c.accentSoft : c.surface, borderWidth: 1.5, borderColor: c.accent })}
      >
        <Text style={{ color: c.accent, fontWeight: "700", fontSize: 15 }}>{t.courtCheck}</Text>
        <Icon ios="arrow.up.right" md="open_in_new" size={14} color={c.accent} fallback="↗" />
      </Pressable>
    </View>
  );
}

/** The court cases saved on this phone, and the card to add one. */
export function CourtCasesSection({ cases, lang }: { cases: CourtCase[]; lang: Lang }) {
  const { c } = useTheme();
  const t = strings(lang);
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: space(3) }}>
      {cases.length > 0 && (
        <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted, marginLeft: space(1) }}>
          {t.courtMine}
        </Text>
      )}
      {cases.map((cs) => (
        <CourtCaseCard key={cs.id} cs={cs} lang={lang} onCopied={() => setCopied(true)} />
      ))}
      {copied && <Banner tone="success">{t.courtCopied}</Banner>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.courtAddTitle}. ${t.courtAddSub}`}
        onPress={() => router.push("/court/new")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space(3),
          padding: space(4),
          borderRadius: radius.lg + 4,
          backgroundColor: pressed ? c.surface2 : c.surface,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: c.border,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.st.done.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon ios="plus" md="add" size={20} color={c.st.done.fg} fallback="+" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: c.heading }}>{t.courtAddTitle}</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.muted }}>{t.courtAddSub}</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{t.courtAddText}</Text>
        </View>
        <Icon ios="arrow.right" md="arrow_forward" size={18} color={c.heading} fallback="→" />
      </Pressable>
    </View>
  );
}
