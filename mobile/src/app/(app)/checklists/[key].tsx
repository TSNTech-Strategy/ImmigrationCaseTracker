import * as WebBrowser from "expo-web-browser";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Card, Loading, Screen, Small } from "../../../components/ui";
import { Icon } from "../../../components/icon";
import { api, ApiError, type ChecklistResponse } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { formatDay } from "../../../lib/i18n";
import { config } from "../../../lib/config";
import { radius, space, useTheme } from "../../../lib/theme";

/** One document checklist: tick documents as you gather them (saved to the account, so the website agrees). */
export default function ChecklistScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<ChecklistResponse | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<ChecklistResponse>(`/api/v1/checklists/${key}`);
      setData(r);
      setDone(new Set(r.done));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [key]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggle(item: string) {
    const on = !done.has(item);
    // Show it right away; put it back if the server says no.
    setDone((prev) => {
      const next = new Set(prev);
      if (on) next.add(item);
      else next.delete(item);
      return next;
    });
    try {
      const r = await api<{ done: string[] }>(`/api/v1/checklists/${key}`, { method: "PUT", body: { item, done: on } });
      setDone(new Set(r.done));
    } catch (e) {
      setDone((prev) => {
        const next = new Set(prev);
        if (on) next.delete(item);
        else next.add(item);
        return next;
      });
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  if (!data && !error) return <Loading />;
  if (!data) {
    return (
      <Screen>
        <Banner tone="danger">{error ?? ""}</Banner>
      </Screen>
    );
  }
  const cl = data.checklist;
  const items = cl.groups.flatMap((g) => g.items);
  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => done.has(i.key)).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Form ${cl.form}` }} />
      {error && <Banner tone="danger">{error}</Banner>}
      <View style={{ gap: space(1) }}>
        <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>
          {cl.title[lang]}
        </Text>
        <Text style={{ fontSize: 15, color: c.muted, lineHeight: 21 }}>{cl.summary[lang]}</Text>
      </View>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{t.checklistReady(requiredDone, required.length)}</Text>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surface2, overflow: "hidden" }}>
          <View style={{ width: `${required.length ? (requiredDone / required.length) * 100 : 0}%`, height: 10, borderRadius: 5, backgroundColor: c.st.done.fg }} />
        </View>
        <Small style={{ fontSize: 12 }}>{t.checklistSaved}</Small>
      </Card>

      {cl.groups.map((g) => (
        <View key={g.key} style={{ gap: space(2) }}>
          <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: c.muted, marginLeft: space(1) }}>
            {g.title[lang]}
          </Text>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
            {g.items.map((i, n) => {
              const on = done.has(i.key);
              return (
                <Pressable
                  key={i.key}
                  accessibilityRole="checkbox"
                  aria-checked={on}
                  accessibilityLabel={`${i.title[lang]}${i.required ? "" : `, ${t.checklistIfApplies}`}`}
                  onPress={() => toggle(i.key)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: space(3),
                    padding: space(4),
                    backgroundColor: pressed ? c.surface2 : "transparent",
                    borderTopWidth: n === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  })}
                >
                  <View style={{ marginTop: 1 }}>
                    {on ? (
                      <Icon ios="checkmark.square.fill" md="check_box" size={22} color={c.st.done.fg} fallback="☑" />
                    ) : (
                      <Icon ios="square" md="check_box_outline_blank" size={22} color={c.muted} fallback="☐" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: on ? c.muted : c.heading, textDecorationLine: on ? "line-through" : "none", lineHeight: 21 }}>{i.title[lang]}</Text>
                    {i.detail ? <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{i.detail[lang]}</Text> : null}
                    {!i.required && (
                      <View style={{ alignSelf: "flex-start", paddingHorizontal: space(2), paddingVertical: 1, borderRadius: 999, backgroundColor: c.surface2, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted }}>{t.checklistIfApplies}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Card>
        <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>
          {t.checklistBefore}
        </Text>
        {[...cl.tips, ...data.tips].map((tip) => (
          <View key={tip.en} style={{ flexDirection: "row", gap: space(2) }}>
            <Text style={{ color: c.muted, fontSize: 15 }}>•</Text>
            <Text style={{ flex: 1, fontSize: 15, color: c.text, lineHeight: 21 }}>{tip[lang]}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>
          {t.checklistOfficial}
        </Text>
        {cl.links.map((l) => (
          <Pressable
            key={l.url}
            accessibilityRole="link"
            onPress={() => (l.url === "/civics-test" ? router.push("/civics") : WebBrowser.openBrowserAsync(l.url.startsWith("/") ? config.apiUrl + l.url : l.url))}
            hitSlop={4}
          >
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15, lineHeight: 21 }}>{l.label[lang]} ↗</Text>
          </Pressable>
        ))}
      </Card>

      <Small style={{ textAlign: "center", fontSize: 12 }}>{t.checklistNote(formatDay(data.reviewed, lang))}</Small>
    </Screen>
  );
}
