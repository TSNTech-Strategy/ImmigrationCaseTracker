import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Loading, Screen, Small } from "../../../components/ui";
import { LargeHeader, SearchField } from "../../../components/cases";
import { IconTile } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { FadeInDown, stagger } from "../../../components/motion";
import { ApiError, type GuideEntry } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { loadGuide } from "../../../lib/guide";
import { loadResources, resourceLook, toolLook, type OfficialTool, type ResourcesResponse } from "../../../lib/resources";
import { radius, space, useTheme } from "../../../lib/theme";

/** One guide: tinted icon, title, one line, chevron. */
function HubCard({ slug, title, summary, onPress }: { slug: string; title: string; summary: string; onPress: () => void }) {
  const { c } = useTheme();
  const look = resourceLook(slug);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space(3.5),
        padding: space(4),
        borderRadius: radius.lg + 4,
        backgroundColor: pressed ? c.surface2 : c.surface,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: c.border,
      })}
    >
      <IconTile glyph={look.glyph} tint={look.tint} size={48} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: c.heading }}>{title}</Text>
        <Text style={{ fontSize: 14, color: c.muted, lineHeight: 19 }}>{summary}</Text>
      </View>
      <Icon ios="chevron.right" md="chevron_right" size={14} color={c.accent} fallback="›" />
    </Pressable>
  );
}

/** A group of search results in one box. */
function Results({ title, rows }: { title: string; rows: { key: string; title: string; sub?: string; onPress: () => void }[] }) {
  const { c } = useTheme();
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space(2) }}>
      <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={r.title}
            onPress={r.onPress}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space(3),
              paddingHorizontal: space(4),
              paddingVertical: space(3),
              backgroundColor: pressed ? c.surface2 : c.surface,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>{r.title}</Text>
              {r.sub ? (
                <Text style={{ fontSize: 13, color: c.muted }} numberOfLines={2}>
                  {r.sub}
                </Text>
              ) : null}
            </View>
            <Icon ios="chevron.right" md="chevron_right" size={13} color={c.muted} fallback="›" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Official government tools (USCIS, CBP): one box of rows that open the official site. */
function OfficialTools({ tools, lang, title, note }: { tools: OfficialTool[]; lang: "en" | "es"; title: string; note: string }) {
  const { c } = useTheme();
  if (tools.length === 0) return null;
  return (
    <View style={{ gap: space(2) }}>
      <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: space(1) }}>
        {title}
      </Text>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
        {tools.map((tool, i) => {
          const look = toolLook(tool.key);
          return (
            <Pressable
              key={tool.key}
              accessibilityRole="link"
              accessibilityLabel={`${tool.title[lang]}. ${tool.summary[lang]}`}
              onPress={() => WebBrowser.openBrowserAsync(tool.url)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space(3),
                paddingHorizontal: space(4),
                paddingVertical: space(3),
                backgroundColor: pressed ? c.surface2 : c.surface,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: c.border,
              })}
            >
              <IconTile glyph={look.glyph} tint={look.tint} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.heading }}>{tool.title[lang]}</Text>
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18 }}>{tool.summary[lang]}</Text>
              </View>
              <Icon ios="arrow.up.right" md="open_in_new" size={13} color={c.accent} fallback="↗" />
            </Pressable>
          );
        })}
      </View>
      <Small style={{ fontSize: 12, marginLeft: space(1) }}>{note}</Small>
    </View>
  );
}

/** The Resources tab: guides for every step of a case, with one search over guides, questions and statuses. */
export default function ResourcesTab() {
  const { t, lang } = useAuth();
  const [data, setData] = useState<ResourcesResponse | null>(null);
  const [statuses, setStatuses] = useState<GuideEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadResources()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    loadGuide()
      .then((g) => setStatuses(g.entries))
      .catch(() => {});
  }, []);

  if (!data && !error) return <Loading />;
  const resources = data?.resources ?? [];
  const q = query.trim().toLowerCase();
  const has = (...values: string[]) => values.some((v) => v.toLowerCase().includes(q));
  const guideHits = q
    ? resources.filter((r) => has(r.title[lang], r.summary[lang], r.intro[lang], ...r.sections.flatMap((s) => [s.heading[lang], ...(s.paragraphs ?? []).map((p) => p[lang]), ...(s.bullets ?? []).map((b) => b[lang])])))
    : [];
  const faq = resources.find((r) => r.slug === "faq")?.faq ?? [];
  const questionHits = q ? faq.map((f, i) => ({ f, i })).filter(({ f }) => has(f.q[lang], f.a[lang])) : [];
  const statusHits = q ? statuses.filter((e) => has(e.heading, ...e.wordings, e[lang].meaning)).slice(0, 8) : [];
  const tools = data?.tools ?? [];
  const toolHits = q ? tools.filter((x) => has(x.title[lang], x.summary[lang])) : [];
  const nothing = q && guideHits.length + questionHits.length + statusHits.length + toolHits.length === 0;

  return (
    <Screen tab>
      <LargeHeader title={t.resourcesTitle} subtitle={t.resourcesSubtitle} />
      {error && <Banner tone="danger">{error}</Banner>}
      <SearchField value={query} onChangeText={setQuery} placeholder={t.searchResources} />

      {q ? (
        <>
          <Results
            title={t.resultsGuides}
            rows={guideHits.map((r) => ({ key: r.slug, title: r.title[lang], sub: r.summary[lang], onPress: () => router.push(`/resources/${r.slug}`) }))}
          />
          <Results
            title={t.resultsQuestions}
            rows={questionHits.map(({ f, i }) => ({ key: `q${i}`, title: f.q[lang], sub: f.a[lang], onPress: () => router.push(`/resources/faq?open=${i}`) }))}
          />
          <Results
            title={t.officialTools}
            rows={toolHits.map((x) => ({ key: x.key, title: x.title[lang], sub: x.summary[lang], onPress: () => WebBrowser.openBrowserAsync(x.url) }))}
          />
          <Results
            title={t.resultsStatuses}
            rows={statusHits.map((e) => ({ key: e.slug, title: e.heading, sub: e[lang].meaning, onPress: () => router.push(`/guide/${e.slug}`) }))}
          />
          {nothing && <Small style={{ textAlign: "center" }}>{t.noMatches}</Small>}
        </>
      ) : (
        <View style={{ gap: space(3) }}>
          {data && (
            <FadeInDown>
              <HubCard slug="library" title={data.statusLibrary.title[lang]} summary={data.statusLibrary.summary[lang]} onPress={() => router.push("/guide")} />
            </FadeInDown>
          )}
          {data && (
            <FadeInDown delay={stagger(1, 60)}>
              <HubCard slug="civics" title={t.civicsTitle} summary={t.civicsSummary} onPress={() => router.push("/civics")} />
            </FadeInDown>
          )}
          {resources.map((r, i) => (
            <FadeInDown key={r.slug} delay={stagger(i + 2, 60)}>
              <HubCard slug={r.slug} title={r.title[lang]} summary={r.summary[lang]} onPress={() => router.push(`/resources/${r.slug}`)} />
            </FadeInDown>
          ))}
          {tools.length > 0 && (
            <FadeInDown delay={stagger(resources.length + 2, 60)} style={{ marginTop: space(2) }}>
              <OfficialTools tools={tools} lang={lang} title={t.officialTools} note={t.officialToolsNote} />
            </FadeInDown>
          )}
        </View>
      )}

      <Small style={{ textAlign: "center" }}>{t.resourcesNote}</Small>
    </Screen>
  );
}
