import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApprovedSeal } from "../../../components/approved";
import { FlagStripe } from "../../../components/celebration";
import { Icon } from "../../../components/icon";
import { FadeInDown } from "../../../components/motion";
import { Banner, Loading, Screen, Small } from "../../../components/ui";
import { api, ApiError, type CaseDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDay } from "../../../lib/i18n";
import { shareJourney } from "../../../lib/share-journey";
import { font, radius, space, useTheme } from "../../../lib/theme";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";

const GOLD = "#F2C14E";
const NAVY = "#0F1B2D";

/** An icon for each step of the line map. */
const STEP_ICON: Record<string, { ios: SFSymbol; md: AndroidSymbol }> = {
  received: { ios: "doc.text", md: "description" },
  biometrics: { ios: "touchid", md: "fingerprint" },
  review: { ios: "magnifyingglass", md: "search" },
  interview: { ios: "person.2", md: "groups" },
  decision: { ios: "trophy", md: "emoji_events" },
  "card-mailed": { ios: "envelope", md: "mail" },
  "card-delivered": { ios: "house", md: "home" },
  "document-mailed": { ios: "envelope", md: "mail" },
  state: { ios: "globe", md: "public" },
  oath: { ios: "flag", md: "flag" },
  after: { ios: "star", md: "star" },
};

/** Journey approved: the celebration for an approved case, and the picture to share. */
export default function JourneyApproved() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [cs, setCs] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setCs((await api<{ case: CaseDetail }>(`/api/v1/cases/${id}`)).case);
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

  if (!cs && !error) return <Loading />;
  const share = cs?.journeyShare ?? null;
  if (!cs || !share) {
    return (
      <Screen>
        <Banner tone="danger">{error ?? t.apNotApproved}</Banner>
      </Screen>
    );
  }
  const code = cs.form?.code ?? cs.formType;
  const scenario = cs.lineMap && cs.lineMap.scenario !== "general" ? cs.lineMap.name[lang] : null;

  async function onShare() {
    if (!share || busy) return;
    setBusy(true);
    setCopied((await shareJourney(cs!.id, share.text[lang], lang, t.shareButton)) === "copied");
    setBusy(false);
  }

  const stat = (label: string, value: string, glyph: { ios: SFSymbol; md: AndroidSymbol }) => (
    <View style={{ flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 2 }}>
      <Icon ios={glyph.ios} md={glyph.md} size={20} color={NAVY} fallback="•" />
      <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#5B6B82", textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color: NAVY, textAlign: "center" }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t.approvedTitle,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={t.shareButton} onPress={onShare} hitSlop={10} style={{ padding: 4 }}>
              <Icon ios="square.and.arrow.up" md="share" size={20} color={c.accent} fallback="↗" />
            </Pressable>
          ),
        }}
      />
      <FadeInDown>
        {/* A light "certificate" in both themes: it's what gets shared. */}
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: radius.lg + 8, borderWidth: 3, borderColor: GOLD, overflow: "hidden" }}>
          <FlagStripe />
          <View style={{ alignItems: "center", paddingHorizontal: space(4), paddingTop: space(5), gap: space(1) }}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#B8233A", letterSpacing: -0.5 }}>{t.congratsTitle}</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 2.5, color: NAVY }}>{t.apHas}</Text>
            <Text accessibilityRole="header" style={{ fontSize: 46, fontWeight: "900", color: NAVY, letterSpacing: -1 }}>
              {t.apApproved}
            </Text>
            <Text style={{ fontSize: 15, color: "#33445C", textAlign: "center", lineHeight: 21, maxWidth: 300 }}>{t.apSub}</Text>
            <View style={{ marginTop: space(1), paddingHorizontal: space(3), paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: GOLD, backgroundColor: "#FFF8E6" }}>
              <Text style={[font.mono, { fontSize: 12, fontWeight: "700", color: NAVY, letterSpacing: 1 }]}>{cs.receiptMasked}</Text>
            </View>
            <View style={{ marginTop: space(3) }}>
              <ApprovedSeal size={210} label={t.apApproved} />
            </View>
            {scenario && (
              <View style={{ marginTop: -space(1), paddingHorizontal: space(4), paddingVertical: 5, borderRadius: 999, backgroundColor: "#E6EFFB" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#1758A8" }}>{scenario}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", marginHorizontal: space(3), marginTop: space(4), paddingVertical: space(3), borderRadius: radius.lg, borderWidth: 1.5, borderColor: "#DCE3EE" }}>
            {stat(t.apForm, code ?? "—", { ios: "doc.text", md: "description" })}
            <View style={{ width: 1.5, backgroundColor: "#DCE3EE" }} />
            {stat(t.apOn, share.approvedOn ? formatDay(share.approvedOn, lang) : "—", { ios: "calendar", md: "calendar_month" })}
            <View style={{ width: 1.5, backgroundColor: "#DCE3EE" }} />
            {stat(t.apLength, share.days !== null ? t.dayCount(share.days) : "—", { ios: "clock", md: "schedule" })}
          </View>

          <Text style={{ marginTop: space(4), textAlign: "center", fontSize: 14, fontWeight: "800", letterSpacing: 2.5, color: NAVY }}>{t.apJourney.toUpperCase()}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: space(3), marginTop: space(3), paddingHorizontal: space(2) }}>
            {share.steps.map((s, i) => {
              const last = i === share.steps.length - 1;
              const icon = STEP_ICON[s.key] ?? STEP_ICON.after;
              return (
                <View key={s.key} style={{ width: "33.3%", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: last ? "#FFF8E6" : NAVY, borderWidth: last ? 2 : 0, borderColor: GOLD }}>
                    <Icon ios={icon.ios} md={icon.md} size={22} color={last ? "#9A6B00" : "#FFFFFF"} fallback="✓" />
                    <View style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: "#1E7A43", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                      <Icon ios="checkmark" md="check" size={9} color="#FFFFFF" fallback="✓" />
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: last ? "#9A6B00" : NAVY, textAlign: "center" }} numberOfLines={2}>
                    {s.label[lang]}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#5B6B82" }}>{s.date ? formatDay(s.date, lang) : t.apNoDate}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), margin: space(3), marginTop: space(4), padding: space(3), borderRadius: radius.lg, borderWidth: 1.5, borderColor: "#DCE3EE" }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }}>
              <Icon ios="heart.fill" md="favorite" size={18} color="#FFFFFF" fallback="♥" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: NAVY, letterSpacing: 0.5 }}>{t.apPaidOff.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, color: "#33445C", lineHeight: 18 }}>{t.apPaidOffText}</Text>
            </View>
            <View style={{ transform: [{ rotate: "-10deg" }], borderWidth: 2, borderColor: "#9AA6B8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: "#9AA6B8", letterSpacing: 1 }}>{t.apStamp}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: NAVY, padding: space(4), gap: space(3), alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: GOLD }}>{t.apShareYour}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.shareButton}
              onPress={onShare}
              disabled={busy}
              style={({ pressed }) => ({ alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2), minHeight: 52, borderRadius: radius.lg, backgroundColor: pressed || busy ? "#E0AE3A" : GOLD })}
            >
              <Icon ios="square.and.arrow.up" md="share" size={18} color={NAVY} fallback="↗" />
              <Text style={{ fontSize: 16, fontWeight: "900", color: NAVY, letterSpacing: 1 }}>{t.shareButton.toUpperCase()}</Text>
            </Pressable>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>{t.apFoot}</Text>
          </View>
        </View>
      </FadeInDown>
      {copied && <Banner tone="success">{t.shareCopied}</Banner>}
      <Small style={{ textAlign: "center", fontSize: 12 }}>{t.shareNote}</Small>
      <View style={{ height: StyleSheet.hairlineWidth }} />
    </Screen>
  );
}
