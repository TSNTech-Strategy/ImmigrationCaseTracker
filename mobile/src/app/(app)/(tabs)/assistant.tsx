import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Small } from "../../../components/ui";
import { IconButton, LargeHeader } from "../../../components/cases";
import { IconTile } from "../../../components/feature";
import { Icon } from "../../../components/icon";
import { api, type CaseDetail } from "../../../lib/api";
import { askAssistant, loadAssistantStatus, type AssistantStatus, type ChatTurn } from "../../../lib/assistant";
import { useAuth } from "../../../lib/auth";
import { radius, space, useTheme } from "../../../lib/theme";

type Turn = ChatTurn & { id: number; state?: "streaming" | "done" | "stopped" | "error" | "refused" };
type CaseRef = { id: string; label: string };

const SPARKLE = { ios: "sparkles", md: "auto_awesome", fallback: "✦" } as const;

/** Plain text with tappable links (they open in the in-app browser, so the chat stays put). */
function RichText({ text, color }: { text: string; color: string }) {
  const { c } = useTheme();
  const parts = text.split(/(https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])/g);
  return (
    <Text style={{ fontSize: 16, lineHeight: 23, color }} selectable>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <Text key={i} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(p)} style={{ color: c.accent, fontWeight: "600", textDecorationLine: "underline" }}>
            {p.replace(/^https?:\/\/(www\.)?/, "")}
          </Text>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </Text>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const { c } = useTheme();
  const { t } = useAuth();
  if (turn.role === "user") {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: c.accent, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: space(4), paddingVertical: space(2.5) }}>
        <Text style={{ fontSize: 16, lineHeight: 23, color: c.onAccent }} selectable>
          {turn.content}
        </Text>
      </View>
    );
  }
  const waiting = turn.state === "streaming" && !turn.content;
  return (
    <View style={{ flexDirection: "row", gap: space(2), alignItems: "flex-start", maxWidth: "92%" }}>
      <View style={{ marginTop: 2 }}>
        <IconTile glyph={SPARKLE} tint="blue" size={28} round />
      </View>
      <View
        accessibilityLabel={waiting ? t.assistantWriting : undefined}
        style={{ flexShrink: 1, backgroundColor: c.surface, borderRadius: 20, borderTopLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, paddingHorizontal: space(4), paddingVertical: space(2.5), gap: space(1) }}
      >
        {waiting ? <Text style={{ fontSize: 20, color: c.muted, letterSpacing: 2 }}>•••</Text> : <RichText text={turn.content + (turn.state === "streaming" ? " ▍" : "")} color={c.text} />}
        {turn.state === "stopped" && <Small>{t.assistantStopped}</Small>}
      </View>
    </View>
  );
}

/** The Assistant tab: ask about statuses, interviews, the civics test or one of your cases. */
export default function AssistantTab() {
  const params = useLocalSearchParams<{ case?: string }>();
  const { t } = useAuth();
  const { c } = useTheme();
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; retry?: string } | null>(null);
  const [aboutCase, setAboutCase] = useState<CaseRef | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<ScrollViewInstance>(null);

  useFocusEffect(
    useCallback(() => {
      loadAssistantStatus()
        .then(setStatus)
        .catch(() => setStatus((s) => s ?? { available: false, plan: "FREE", limit: 0, used: 0, remaining: 0 }));
    }, []),
  );

  // Opened from a case ("Ask the assistant"): questions are about that case.
  useEffect(() => {
    const id = params.case;
    if (!id) return;
    api<{ case: CaseDetail }>(`/api/v1/cases/${id}`)
      .then(({ case: cs }) => setAboutCase({ id: cs.id, label: [cs.nickname ?? cs.form?.code ?? cs.formType, cs.statusTitleEn].filter(Boolean).join(" · ") }))
      .catch(() => {});
  }, [params.case]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
      abort.current?.abort();
    };
  }, []);

  const update = (id: number, change: (x: Turn) => Turn) => setTurns((ts) => ts.map((x) => (x.id === id ? change(x) : x)));
  const remaining = status?.remaining ?? 0;

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy || !status?.available) return;
    setProblem(null);
    const history: ChatTurn[] = [];
    for (let i = 0; i + 1 < turns.length; i++) {
      const [q, a] = [turns[i], turns[i + 1]];
      if (q.role === "user" && a.role === "assistant" && a.content.trim() && a.state !== "refused") {
        history.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
        i++;
      }
    }
    const userTurn: Turn = { id: nextId.current++, role: "user", content: text };
    const answer: Turn = { id: nextId.current++, role: "assistant", content: "", state: "streaming" };
    setTurns((ts) => [...ts.filter((x) => x.state !== "error"), userTurn, answer]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const fail = (message: string, retry?: string) => {
      setTurns((ts) => ts.filter((x) => !(x.id === answer.id && !x.content)).map((x) => (x.id === userTurn.id ? { ...x, state: "error" } : x.id === answer.id ? { ...x, state: "stopped" } : x)));
      setProblem({ message, retry });
    };
    await askAssistant([...history, { role: "user", content: text }], aboutCase?.id ?? null, controller.signal, {
      text: (piece) => update(answer.id, (x) => ({ ...x, content: x.content + piece })),
      reset: () => update(answer.id, (x) => ({ ...x, content: "" })),
      refusal: () => update(answer.id, (x) => ({ ...x, content: t.assistantRefused, state: "refused" })),
      done: (left) => {
        if (left !== null) setStatus((s) => (s ? { ...s, remaining: left } : s));
        update(answer.id, (x) => ({ ...x, state: x.state === "refused" ? "refused" : "done" }));
      },
      error: (code, message) => {
        if (code === "limit") {
          setStatus((s) => (s ? { ...s, remaining: 0 } : s));
          fail(t.assistantLimit(status.limit));
        } else if (code === "too_long") {
          setDraft(text);
          fail(t.assistantTooLong);
        } else if (code === "unavailable") {
          setStatus((s) => (s ? { ...s, available: false } : s));
          fail(t.assistantUnavailable);
        } else {
          fail(code === "busy" ? t.assistantBusy : code === "offline" ? t.assistantOffline : message || t.assistantFailed, text);
        }
      },
    });
    if (controller.signal.aborted) {
      setTurns((ts) => ts.filter((x) => !(x.id === answer.id && !x.content)).map((x) => (x.id === answer.id && x.state === "streaming" ? { ...x, state: "stopped" } : x)));
    }
    setBusy(false);
    abort.current = null;
  };

  const newChat = () => {
    abort.current?.abort();
    setTurns([]);
    setProblem(null);
  };

  const suggestions = aboutCase ? t.assistantCaseSuggestions : t.assistantSuggestions;
  const web = Platform.OS === "web";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      {/* The tab bar sits below on phones: keep the composer above it, except while the keyboard covers it. */}
      <SafeAreaView edges={web || keyboard ? ["top"] : ["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: space(5), gap: space(3.5), paddingTop: web ? space(20) : space(5), flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <LargeHeader
            title={t.assistantTitle}
            subtitle={t.assistantSubtitle}
            right={turns.length > 0 ? <IconButton ios="square.and.pencil" md="edit_square" label={t.assistantNew} onPress={newChat} fallback="✎" /> : undefined}
          />

          {status && !status.available ? (
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, padding: space(5), gap: space(3), alignItems: "center" }}>
              <IconTile glyph={SPARKLE} tint="blue" size={52} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: c.heading, textAlign: "center" }}>{t.assistantUnavailableTitle}</Text>
              <Text style={{ fontSize: 15, color: c.muted, textAlign: "center", lineHeight: 21 }}>{t.assistantUnavailable}</Text>
            </View>
          ) : turns.length === 0 ? (
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, padding: space(5), gap: space(3) }}>
              <IconTile glyph={SPARKLE} tint="blue" size={48} />
              <Text style={{ fontSize: 20, fontWeight: "800", color: c.heading }}>{aboutCase ? t.assistantAboutCaseTitle : t.assistantHello}</Text>
              <Text style={{ fontSize: 15, color: c.muted, lineHeight: 21 }}>{t.assistantIntro}</Text>
              <View style={{ gap: space(2) }}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    disabled={busy || remaining <= 0 || !status}
                    onPress={() => ask(s)}
                    style={({ pressed }) => ({
                      borderRadius: 999,
                      borderWidth: StyleSheet.hairlineWidth * 2,
                      borderColor: c.border,
                      backgroundColor: pressed ? c.accentSoft : c.surface,
                      paddingHorizontal: space(4),
                      paddingVertical: space(2.5),
                      opacity: remaining <= 0 ? 0.5 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: space(3.5) }}>
              {turns.map((x) => (
                <Bubble key={x.id} turn={x} />
              ))}
            </View>
          )}

          {problem && (
            <View style={{ gap: space(2) }}>
              <Banner tone="danger">{problem.message}</Banner>
              {problem.retry && (
                <Pressable accessibilityRole="button" onPress={() => ask(problem.retry!)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
                  <Text style={{ color: c.accent, fontWeight: "700", fontSize: 15 }}>{t.assistantRetry}</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {status?.available && (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.background, paddingHorizontal: space(4), paddingTop: space(2.5), paddingBottom: space(web ? 4 : 2.5), gap: space(2) }}>
            {aboutCase && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
                <View style={{ backgroundColor: c.accentSoft, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: 4, flexShrink: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: c.accent }}>
                    {t.assistantAbout(aboutCase.label)}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setAboutCase(null)} hitSlop={6}>
                  <Text style={{ fontSize: 12, color: c.muted, textDecorationLine: "underline" }}>{t.assistantGeneral}</Text>
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space(2) }}>
              <TextInput
                accessibilityLabel={t.assistantPlaceholder}
                value={draft}
                onChangeText={setDraft}
                placeholder={remaining > 0 ? t.assistantPlaceholder : t.assistantNoneLeft}
                placeholderTextColor={c.muted}
                editable={remaining > 0}
                multiline
                // The web preview starts as one line, like the phone.
                {...(Platform.OS === "web" ? { numberOfLines: 1 } : {})}
                maxLength={2000}
                style={{ flex: 1, maxHeight: 120, minHeight: 46, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, backgroundColor: c.surface, color: c.text, fontSize: 16, paddingHorizontal: space(3.5), paddingTop: space(3), paddingBottom: space(3) }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={busy ? t.assistantStop : t.assistantSend}
                disabled={!busy && (!draft.trim() || remaining <= 0)}
                onPress={() => (busy ? abort.current?.abort() : ask(draft))}
                style={({ pressed }) => ({
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: busy ? c.surface2 : pressed ? c.accentPressed : c.accent,
                  opacity: !busy && (!draft.trim() || remaining <= 0) ? 0.45 : 1,
                })}
              >
                <Icon
                  ios={busy ? "stop.fill" : "arrow.up"}
                  md={busy ? "stop" : "arrow_upward"}
                  size={20}
                  color={busy ? c.text : c.onAccent}
                  fallback={busy ? "■" : "↑"}
                />
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: c.muted, lineHeight: 15 }}>
              {status ? `${t.assistantLeft(remaining, status.limit)} · ` : ""}
              {t.assistantNote}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
