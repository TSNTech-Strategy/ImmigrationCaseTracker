import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { CaseFilter, CaseGroup, CaseSummary, CourtResponse, JourneyShare } from "../lib/api";
import { formatDay, type Lang, strings } from "../lib/i18n";
import { radius, space, useTheme } from "../lib/theme";
import { FlagStripe, StarsMark } from "./celebration";
import { IconTile, type Glyph, type Tint } from "./feature";
import { Icon } from "./icon";
import { Button, Card, Small } from "./ui";

// ---- Groups and tiles -------------------------------------------------------------

export const GROUP_ORDER: CaseGroup[] = ["attention", "progress", "completed"];
export const TILE_ORDER = ["attention", "interview", "approved", "active"] as const satisfies readonly CaseFilter[];
/** How many completed cases show before "View all". */
export const COMPLETED_PREVIEW = 3;

type Glance = { group: CaseGroup; interview: boolean; approvedRecently: boolean };
/** The server decides; an older server's list is grouped from the status colour and the line map. */
export function glanceOf(x: CaseSummary): Glance {
  return {
    group: x.group ?? (x.category === "action" ? "attention" : x.lineMap?.finished ? "completed" : "progress"),
    interview: x.interview ?? false,
    approvedRecently: x.approvedRecently ?? Boolean(x.recentApprovalAt),
  };
}
export function matchesFilter(g: Glance, f: CaseFilter): boolean {
  if (f === "attention") return g.group === "attention";
  if (f === "interview") return g.interview;
  if (f === "approved") return g.approvedRecently;
  if (f === "active") return g.group !== "completed";
  return g.group === "completed";
}

const TILE_LOOK: Record<(typeof TILE_ORDER)[number], { glyph: Glyph; tint: Tint }> = {
  attention: { glyph: { ios: "exclamationmark.circle", md: "error", fallback: "!" }, tint: "amber" },
  interview: { glyph: { ios: "person.2", md: "groups", fallback: "☺" }, tint: "navy" },
  approved: { glyph: { ios: "checkmark.seal", md: "verified", fallback: "✓" }, tint: "green" },
  active: { glyph: { ios: "hourglass", md: "hourglass_top", fallback: "◷" }, tint: "blue" },
};

/** Four tiles with counts; tapping one shows only those cases (tap again for all). */
export function SummaryTiles({ counts, value, onChange, lang }: { counts: Record<CaseFilter, number>; value: CaseFilter | null; onChange: (f: CaseFilter | null) => void; lang: Lang }) {
  const { c } = useTheme();
  const t = strings(lang);
  return (
    <View accessibilityLabel={t.tilesLabel} style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2.5) }}>
      {TILE_ORDER.map((f) => {
        const on = value === f;
        return (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.tile[f]}: ${counts[f]}`}
            onPress={() => onChange(on ? null : f)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: "45%",
              gap: space(2),
              padding: space(3),
              borderRadius: radius.lg,
              backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : c.surface,
              borderWidth: on ? 2 : StyleSheet.hairlineWidth * 2,
              borderColor: on ? c.accent : c.border,
              // Same height whether selected (2pt border) or not.
              margin: on ? 0 : 2 - StyleSheet.hairlineWidth * 2,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) }}>
              <IconTile glyph={TILE_LOOK[f].glyph} tint={TILE_LOOK[f].tint} size={34} />
              <Text style={{ fontSize: 24, fontWeight: "800", color: c.heading, fontVariant: ["tabular-nums"] }}>{counts[f]}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: on ? c.accent : c.muted, lineHeight: 18 }} numberOfLines={2}>
              {t.tile[f]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "NEEDS ATTENTION 2" above a section, with an optional action on the right. */
export function GroupHeader({ title, count, action }: { title: string; count: number; action?: { label: string; onPress: () => void } }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginTop: space(2), marginLeft: space(1) }}>
      <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted }}>
        {title}
      </Text>
      <View style={{ minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.text }}>{count}</Text>
      </View>
      <View style={{ flex: 1 }} />
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <Text style={{ color: c.accent, fontWeight: "600", fontSize: 14 }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---- Share my journey ---------------------------------------------------------------

/** An approved case on its screen: the approval day, how long it took, and the way to the Journey approved screen (where it's shared). */
export function ShareJourneyCard({ share, formCode, lang, caseId }: { share: JourneyShare; formCode: string | null; lang: Lang; caseId: string }) {
  const { c } = useTheme();
  const t = strings(lang);
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
      <FlagStripe />
      <View style={{ padding: space(4), gap: space(3) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
          <StarsMark size={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted }}>{t.shareTitle}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
              <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.heading }}>
                {t.shareApproved}
              </Text>
              {formCode && (
                <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 6, backgroundColor: c.accentSoft }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: c.accent }}>{formCode}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {(share.approvedOn || share.days !== null) && (
          <View style={{ gap: 2 }}>
            {share.approvedOn && <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{t.shareApprovedOn(formatDay(share.approvedOn, lang))}</Text>}
            {share.days !== null && <Text style={{ fontSize: 14, color: c.muted }}>{t.shareDays(share.days)}</Text>}
          </View>
        )}
        <ShareJourneyButton caseId={caseId} lang={lang} />
        <Small style={{ fontSize: 12, textAlign: "center" }}>{t.shareNote}</Small>
      </View>
    </View>
  );
}

/** The gold "Share my journey" button: opens the Journey approved screen. */
export function ShareJourneyButton({ caseId, lang, compact = false }: { caseId: string; lang: Lang; compact?: boolean }) {
  const t = strings(lang);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.shareButton}
      onPress={() => router.push(`/approved/${caseId}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space(2),
        minHeight: compact ? 44 : 50,
        borderRadius: radius.lg,
        backgroundColor: pressed ? "#E0AE3A" : "#F2C14E",
        borderWidth: 1,
        borderColor: "#D9A632",
      })}
    >
      <Icon ios="trophy" md="emoji_events" size={18} color="#0F1B2D" fallback="★" />
      <Text style={{ fontSize: compact ? 15 : 16, fontWeight: "800", color: "#0F1B2D" }}>{t.shareButton}</Text>
    </Pressable>
  );
}

// ---- Immigration court -------------------------------------------------------------------

/** The immigration court guide: EOIR's own tools (online and phone), tips and official links. */
export function CourtGuideView({ data, lang }: { data: CourtResponse; lang: Lang }) {
  const { c } = useTheme();
  const t = strings(lang);
  const g = data.guide;
  const open = (url: string) => (url.startsWith("tel:") ? Linking.openURL(url) : WebBrowser.openBrowserAsync(url));
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
          <IconTile glyph={{ ios: "building.columns", md: "account_balance", fallback: "⚖" }} tint="navy" size={44} />
          <Text accessibilityRole="header" style={{ flex: 1, fontSize: 20, fontWeight: "800", color: c.heading }}>
            {g.title[lang]}
          </Text>
        </View>
        <Text style={{ fontSize: 15, color: c.text, lineHeight: 22 }}>{g.intro[lang]}</Text>
      </Card>

      <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{g.aNumber.title[lang]}</Text>
        <Text style={{ fontSize: 15, color: c.text, lineHeight: 22 }}>{g.aNumber.text[lang]}</Text>
      </Card>

      <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted, marginLeft: space(1) }}>
        {t.courtWays}
      </Text>
      {g.ways.map((w) => (
        <Card key={w.key}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <IconTile glyph={w.key === "phone" ? { ios: "phone", md: "call", fallback: "☎" } : { ios: "globe", md: "language", fallback: "◎" }} tint="blue" size={40} />
            <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: c.heading }}>{w.title[lang]}</Text>
          </View>
          <Text style={{ fontSize: 15, color: c.text, lineHeight: 22 }}>{w.text[lang]}</Text>
          <Button
            title={w.link.label[lang]}
            variant={w.key === "phone" ? "secondary" : "primary"}
            iconAfter={w.key === "phone" ? undefined : { ios: "arrow.up.right", md: "open_in_new", fallback: "↗" }}
            onPress={() => open(w.link.url)}
          />
        </Card>
      ))}

      <Card>
        <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>
          {t.courtTips}
        </Text>
        {g.tips.map((tip) => (
          <View key={tip.en} style={{ flexDirection: "row", gap: space(2) }}>
            <Text style={{ color: c.muted, fontSize: 15 }}>•</Text>
            <Text style={{ flex: 1, fontSize: 15, color: c.text, lineHeight: 21 }}>{tip[lang]}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>
          {t.courtLinks}
        </Text>
        {g.links.map((l) => (
          <Pressable key={l.url} accessibilityRole="link" onPress={() => open(l.url)} hitSlop={4} style={{ gap: 2 }}>
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15, lineHeight: 21 }}>{l.label[lang]} ↗</Text>
            {l.text && <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{l.text[lang]}</Text>}
          </Pressable>
        ))}
      </Card>

      <Small style={{ textAlign: "center", fontSize: 12 }}>
        {g.note[lang]} {t.courtReviewed(formatDay(data.reviewed, lang))}
      </Small>
    </View>
  );
}
