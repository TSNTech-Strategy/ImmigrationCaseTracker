import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, H2, Loading, Screen, Small } from "../../../components/ui";
import { IconTile } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { appRouteFor, loadResources, openResourceLink, resourceLook, type ResourceLink, type ResourcesResponse } from "../../../lib/resources";
import { radius, space, useTheme } from "../../../lib/theme";

const host = (url: string) => {
  const m = /^https?:\/\/([^/]+)/.exec(url);
  return m ? m[1].replace(/^www\./, "") : null;
};

/** Links: app screens with a chevron, official pages (opening in the in-app browser) with their address. */
function LinkRows({ links }: { links: ResourceLink[] }) {
  const { c } = useTheme();
  const { lang } = useAuth();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
      {links.map((l, i) => {
        const inApp = appRouteFor(l.url) !== null;
        return (
          <Pressable
            key={l.url}
            accessibilityRole="link"
            accessibilityLabel={l.label[lang]}
            onPress={() => openResourceLink(l.url)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space(3),
              paddingHorizontal: space(4),
              paddingVertical: space(3.5),
              backgroundColor: pressed ? c.surface2 : c.surface,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: c.accent }}>{l.label[lang]}</Text>
              {!inApp && host(l.url) ? <Text style={{ fontSize: 12, color: c.muted }}>{host(l.url)}</Text> : null}
            </View>
            {inApp ? (
              <Icon ios="chevron.right" md="chevron_right" size={13} color={c.muted} fallback="›" />
            ) : (
              <Icon ios="arrow.up.right" md="open_in_new" size={14} color={c.muted} fallback="↗" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** One guide from the resource center: sections, questions (tap to open), and links. */
export default function ResourceScreen() {
  const { slug, open } = useLocalSearchParams<{ slug: string; open?: string }>();
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<ResourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<number[]>(() => (open !== undefined && /^\d+$/.test(open) ? [Number(open)] : []));

  useEffect(() => {
    loadResources()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, []);

  if (!data && !error) return <Loading />;
  const r = data?.resources.find((x) => x.slug === slug);
  const look = resourceLook(slug);
  const toggle = (i: number) => setOpened((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  return (
    <Screen>
      <Stack.Screen options={{ title: r ? r.title[lang] : "" }} />
      {error && <Banner tone="danger">{error}</Banner>}
      {r && (
        <>
          <View style={{ gap: space(3) }}>
            <IconTile glyph={look.glyph} tint={look.tint} size={52} />
            <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>
              {r.title[lang]}
            </Text>
            <Body muted>{r.intro[lang]}</Body>
          </View>

          {slug === "contact" && (
            <Card style={{ padding: space(4), gap: space(3) }}>
              <H2>{t.emailUs}</H2>
              {data?.contactEmail ? (
                <Button title={data.contactEmail} onPress={() => Linking.openURL(`mailto:${data.contactEmail}`)} icon={{ ios: "envelope", md: "mail", fallback: "✉" }} />
              ) : (
                <Small>{t.emailSoon}</Small>
              )}
            </Card>
          )}

          {r.sections.map((s) => (
            <View key={s.heading.en} style={{ gap: space(2) }}>
              <H2>{s.heading[lang]}</H2>
              {s.paragraphs?.map((p) => <Body key={p.en}>{p[lang]}</Body>)}
              {s.bullets?.map((b) => (
                <View key={b.en} style={{ flexDirection: "row", gap: space(2.5), paddingRight: space(2) }}>
                  <Text style={{ color: c.accent, fontSize: 18, lineHeight: 23 }}>•</Text>
                  <Body style={{ flex: 1 }}>{b[lang]}</Body>
                </View>
              ))}
            </View>
          ))}

          {r.faq && (
            <View style={{ gap: space(2) }}>
              {r.faq.map((f, i) => {
                const isOpen = opened.includes(i);
                return (
                  <View key={f.q.en} style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: isOpen ? c.accent : c.border, overflow: "hidden" }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => toggle(i)}
                      style={{ flexDirection: "row", alignItems: "center", gap: space(3), padding: space(4) }}
                    >
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: c.heading }}>{f.q[lang]}</Text>
                      <Icon ios={isOpen ? "chevron.up" : "chevron.down"} md={isOpen ? "expand_less" : "expand_more"} size={14} color={c.muted} fallback={isOpen ? "˄" : "˅"} />
                    </Pressable>
                    {isOpen && (
                      <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), gap: space(3) }}>
                        <Body muted>{f.a[lang]}</Body>
                        {f.links && f.links.length > 0 && <LinkRows links={f.links} />}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {r.links.length > 0 && (
            <View style={{ gap: space(2) }}>
              <H2>{r.links.every((l) => appRouteFor(l.url) !== null) ? t.learnMore : t.officialLinks}</H2>
              <LinkRows links={r.links} />
            </View>
          )}
        </>
      )}
      <Small style={{ textAlign: "center" }}>{t.resourcesNote}</Small>
    </Screen>
  );
}
