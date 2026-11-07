import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Screen, Small } from "../../../components/ui";
import { IconButton, LargeHeader } from "../../../components/cases";
import { IconTile, type Tint } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { FadeInDown, stagger } from "../../../components/motion";
import { api, ApiError, type StatusCategory, type UpdateItem } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDay, shortDate, timeAgo, type Lang } from "../../../lib/i18n";
import { markSeen, seenChanges } from "../../../lib/seen";
import { radius, space, useTheme } from "../../../lib/theme";
import { setUnreadUpdates } from "../../../lib/updates-badge";
import { useRefreshOnForeground } from "../../../lib/use-refresh";

const TINT: Record<StatusCategory, Tint> = { progress: "blue", action: "amber", done: "green", stop: "red", none: "navy" };
const GLYPH: Record<StatusCategory, { ios: "doc.text" | "exclamationmark.circle" | "checkmark.seal" | "xmark.octagon"; md: "description" | "error" | "verified" | "block"; fallback: string }> = {
  progress: { ios: "doc.text", md: "description", fallback: "•" },
  action: { ios: "exclamationmark.circle", md: "error", fallback: "!" },
  done: { ios: "checkmark.seal", md: "verified", fallback: "✓" },
  stop: { ios: "xmark.octagon", md: "block", fallback: "×" },
  none: { ios: "doc.text", md: "description", fallback: "•" },
};

/** "Today", "Yesterday" or the date, for grouping. */
function dayHeading(iso: string, lang: Lang, t: ReturnType<typeof useAuth>["t"]) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return t.today;
  if (d.toDateString() === yesterday.toDateString()) return t.yesterdayHeading;
  return shortDate(iso, lang);
}

/** The Updates tab: every status change across the person's cases, newest first. */
export default function Updates() {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [items, setItems] = useState<UpdateItem[] | null>(null);
  const [seen, setSeen] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ updates: UpdateItem[] }>("/api/v1/updates");
      // A first launch counts what's already there as seen (like My cases).
      const latest = new Map<string, string>();
      for (const u of r.updates) if (!latest.has(u.caseId)) latest.set(u.caseId, u.at);
      const s = await seenChanges([...latest].map(([id, at]) => ({ id, lastChangeObservedAt: at })));
      setSeen(s);
      setItems(r.updates);
      setError(null);
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

  const isUnread = useCallback((u: UpdateItem) => Boolean(seen && (!seen[u.caseId] || seen[u.caseId] < u.at)), [seen]);
  const unreadCases = useMemo(() => new Set((items ?? []).filter(isUnread).map((u) => u.caseId)), [items, isUnread]);
  // Keep the tab badge in step with what this screen shows.
  useEffect(() => {
    if (items) setUnreadUpdates(unreadCases.size);
  }, [items, unreadCases]);

  async function markAllRead() {
    if (!items) return;
    const latest = new Map<string, string>();
    for (const u of items) if (!latest.has(u.caseId)) latest.set(u.caseId, u.at);
    for (const [caseId, at] of latest) await markSeen(caseId, at);
    await load();
  }

  const groups = useMemo(() => {
    const out: { heading: string; rows: UpdateItem[] }[] = [];
    for (const u of items ?? []) {
      const heading = dayHeading(u.at, lang, t);
      const last = out[out.length - 1];
      if (last && last.heading === heading) last.rows.push(u);
      else out.push({ heading, rows: [u] });
    }
    return out;
  }, [items, lang, t]);

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
      <LargeHeader
        title={t.updatesTitle}
        subtitle={unreadCases.size ? `${unreadCases.size} ${t.unread.toLowerCase()}` : " "}
        right={unreadCases.size ? <IconButton ios="checkmark.circle" md="done_all" label={t.updatesMarkRead} onPress={markAllRead} fallback="✓" /> : undefined}
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {items && items.length === 0 && (
        <View style={{ alignItems: "center", gap: space(3), paddingVertical: space(8) }}>
          <IconTile glyph={{ ios: "bell", md: "notifications", fallback: "!" }} tint="blue" size={56} />
          <Text style={{ fontSize: 15, color: c.muted, textAlign: "center", lineHeight: 21, maxWidth: 300 }}>{t.updatesEmpty}</Text>
        </View>
      )}
      {groups.map((g, gi) => (
        <FadeInDown key={g.heading} delay={stagger(gi, 60)} style={{ gap: space(2) }}>
          <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted, marginLeft: space(1) }}>
            {g.heading}
          </Text>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            {g.rows.map((u, i) => {
              const unread = isUnread(u);
              const status = (lang === "es" ? u.statusTitleEs : u.statusTitleEn) ?? u.statusTitleEn ?? "—";
              const name = u.nickname ?? (u.form ? `${t.form} ${u.form.code}` : u.receiptMasked);
              return (
                <View key={u.id}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: space(4) + 40 + space(3) }} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${unread ? `${t.unread}. ` : ""}${name}. ${status}.`}
                    onPress={() => router.push(`/cases/${u.caseId}`)}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: space(3), padding: space(4), backgroundColor: pressed ? c.surface2 : unread ? c.accentSoft : "transparent" })}
                  >
                    <IconTile glyph={GLYPH[u.category]} tint={TINT[u.category]} size={40} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: c.muted }} numberOfLines={1}>
                          {name}
                          {u.nickname && u.form ? ` · ${u.form.code}` : ""}
                        </Text>
                        <Text style={{ fontSize: 12, color: c.muted }}>{timeAgo(u.at, lang)}</Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: unread ? "800" : "700", color: c.heading, lineHeight: 21 }}>{status}</Text>
                      <Text style={{ fontSize: 13, color: c.muted }}>
                        {u.first ? t.updateStarted : t.updateChanged}
                        {u.reportedDate ? ` · ${formatDay(u.reportedDate, lang)}` : ""}
                      </Text>
                    </View>
                    {unread ? (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandRed, marginTop: 6 }} />
                    ) : (
                      <Icon ios="chevron.right" md="chevron_right" size={13} color={c.muted} fallback="›" />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </FadeInDown>
      ))}
      <Small style={{ textAlign: "center" }}>{t.updatesNote}</Small>
    </Screen>
  );
}
