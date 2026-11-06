import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Body, Button, Card, Loading, Screen, Small } from "../../../components/ui";
import { Icon } from "../../../components/icon";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { choicesFor, loadCivics, mockPool, outcome, seededRandom, shuffle, type CivicsQuestion, type CivicsResponse } from "../../../lib/civics";
import { radius, space, useTheme } from "../../../lib/theme";

type Item = { q: CivicsQuestion; choices: string[] };
/** correct is null for questions that can't be checked here (they depend on where you live). */
type Answer = { q: CivicsQuestion; choice: string | null; correct: boolean | null };

function Link({ label, url }: { label: string; url: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => WebBrowser.openBrowserAsync(url)} hitSlop={6}>
      <Text style={{ color: c.accent, fontWeight: "600", fontSize: 15 }}>{label} ↗</Text>
    </Pressable>
  );
}

/** The official answers for a question, or how to find a local one. */
function Answers({ q, data }: { q: CivicsQuestion; data: CivicsResponse }) {
  const { t, lang } = useAuth();
  const { c } = useTheme();
  if (q.kind === "local") {
    return (
      <View style={{ gap: space(2) }}>
        <Body>{data.text.local[lang]}</Body>
        <View style={{ gap: space(1.5) }}>
          <Link label={t.civicsSenators} url={data.links.senators} />
          <Link label={t.civicsRepresentative} url={data.links.representative} />
          <Link label={t.civicsOfficials} url={data.links.electedOfficials} />
        </View>
        {q.note ? <Small>{q.note}</Small> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: c.heading }}>{t.civicsAccepted(q.answers.length, q.pick)}</Text>
      {q.answers.map((a) => (
        <View key={a} style={{ flexDirection: "row", gap: space(2), paddingRight: space(2) }}>
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21 }}>•</Text>
          <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21 }}>{a}</Text>
        </View>
      ))}
      {q.kind === "current" ? (
        <View style={{ gap: space(1.5), paddingTop: space(1) }}>
          <Small>{data.text.current[lang]}</Small>
          <Link label={t.civicsTestUpdates} url={data.links.testUpdates} />
        </View>
      ) : q.note ? (
        <Small>{q.note}</Small>
      ) : null}
    </View>
  );
}

/** One run of civics practice: a mock test (official stop rules) or one section, then the result. */
export default function CivicsQuiz() {
  const { v, mode, senior: seniorParam } = useLocalSearchParams<{ v?: string; mode?: string; senior?: string }>();
  const senior = seniorParam === "1";
  const isMock = mode === "mock";
  const { t, lang } = useAuth();
  const { c } = useTheme();
  const [data, setData] = useState<CivicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A new seed reshuffles the questions and choices for "try again".
  const [seed, setSeed] = useState(() => Math.random());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    loadCivics()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    return () => {
      Speech.stop();
    };
  }, []);

  const test = data?.versions.find((x) => x.version === v) ?? data?.versions[0];
  const rules = test ? (senior ? test.rules.senior : test.rules.standard) : null;
  const section = test?.sections.find((s) => s.key === mode);
  const items = useMemo<Item[]>(() => {
    if (!test || !rules) return [];
    const random = seededRandom(seed);
    const pool = isMock
      ? shuffle(mockPool(test.questions, senior), random).slice(0, rules.ask)
      : shuffle(
          test.questions.filter((q) => q.section === mode && (!senior || q.star)),
          random,
        );
    return pool.map((q) => ({ q, choices: choicesFor(q, random) }));
  }, [test, rules, isMock, mode, senior, seed]);

  if (!data && !error) return <Loading />;
  if (error || !test || !rules || !data) {
    return (
      <Screen>
        <Banner tone="danger">{error ?? "—"}</Banner>
      </Screen>
    );
  }

  const title = isMock ? `${t.civicsMock} · ${test.title[lang]}${senior ? " (65/20)" : ""}` : (section?.title[lang] ?? "");
  const scored = answers.filter((a) => a.correct !== null);
  const right = scored.filter((a) => a.correct).length;
  const decided = isMock ? outcome(rules, scored.map((a) => Boolean(a.correct))) : null;
  const item = items[index];
  const answered = item ? answers.find((a) => a.q.id === item.q.id) : undefined;
  const finished = Boolean(answered && (decided || index >= items.length - 1));

  const choose = (choice: string | null) => {
    if (!item || answered) return;
    const correct = item.q.kind === "local" ? null : choice === item.q.right;
    setAnswers([...answers, { q: item.q, choice, correct }]);
    if (correct !== null) {
      AccessibilityInfo.announceForAccessibility(correct ? t.civicsCorrect : t.civicsWrong);
      if (Platform.OS !== "web") Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };
  const next = () => {
    Speech.stop();
    if (finished) setShowResult(true);
    else setIndex(index + 1);
  };
  const again = () => {
    setSeed(Math.random());
    setIndex(0);
    setAnswers([]);
    setShowResult(false);
  };
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: "en-US", rate: 0.95 });
  };

  // ---- Result ----
  if (showResult) {
    const total = scored.length;
    const share = total ? right / total : 0;
    const passed = isMock ? decided === "pass" : share >= data.practicePassShare;
    const tone = passed ? c.st.done : c.st.stop;
    const missed = answers.filter((a) => a.correct === false);
    return (
      <Screen key={`result-${seed}`}>
        <Stack.Screen options={{ title }} />
        <View accessibilityRole="summary" style={{ backgroundColor: tone.bg, borderColor: tone.fg, borderWidth: 1.5, borderRadius: radius.lg + 4, padding: space(5), gap: space(2) }}>
          <Icon ios={passed ? "checkmark.circle.fill" : "xmark.circle.fill"} md={passed ? "check_circle" : "cancel"} size={36} color={tone.fg} fallback={passed ? "✓" : "✕"} />
          <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: "800", color: c.heading, letterSpacing: -0.4 }}>
            {isMock ? (passed ? t.civicsPassed : t.civicsNotYet) : passed ? t.civicsPassingScore : t.civicsKeepPracticing}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
            {t.civicsScore(right, total)}
            {!isMock && total ? ` (${Math.round(share * 100)}%)` : ""}
          </Text>
          <Small>{isMock ? t.civicsMockRule(rules.pass, rules.failAt, rules.ask) : t.civicsSectionRule(Math.round(data.practicePassShare * 100), rules.pass, rules.ask)}</Small>
        </View>
        <Button title={isMock ? t.civicsAgainMock : t.civicsAgainSection} onPress={again} />
        <Button title={t.civicsAllPractice} variant="secondary" onPress={() => router.back()} />
        {missed.length > 0 && (
          <View style={{ gap: space(3) }}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: c.heading }}>
              {t.civicsReview}
            </Text>
            {missed.map((a) => (
              <Card key={a.q.id} style={{ padding: space(4), gap: space(2.5) }}>
                <Small>{t.civicsQuestionN(a.q.n)}</Small>
                <Text style={{ fontSize: 17, fontWeight: "700", color: c.heading }}>{a.q.q}</Text>
                <Text style={{ fontSize: 15, color: c.text }}>
                  {t.civicsYouChose} <Text style={{ color: c.st.stop.fg, fontWeight: "600" }}>{a.choice}</Text>
                </Text>
                <Answers q={a.q} data={data} />
              </Card>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  if (!item) return <Loading />;
  const q = item.q;
  const progress = isMock ? Math.min(1, answers.length / rules.ask) : answers.length / items.length;

  // ---- A question ----
  return (
    // A new key per question starts each one scrolled to the top.
    <Screen key={`${seed}-${index}`}>
      <Stack.Screen options={{ title }} />
      <View style={{ gap: space(2) }}>
        <Small>
          {isMock ? t.civicsProgressMock(index + 1, rules.ask, right, scored.length - right, rules.pass) : t.civicsProgressSection(index + 1, items.length, right)}
        </Small>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: "hidden" }}>
          <View style={{ width: `${progress * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
        </View>
      </View>

      <Card style={{ padding: space(5), gap: space(4) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.muted }}>{t.civicsQuestionN(q.n)}</Text>
            {q.star && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.st.action.bg, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: 2 }}>
                <Icon ios="star.fill" md="star" size={11} color={c.st.action.fg} fallback="★" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.st.action.fg }}>65/20</Text>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.civicsListen}
            onPress={() => speak(q.q)}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderRadius: radius.sm, backgroundColor: pressed ? c.accentSoft : "transparent" })}
          >
            <Icon ios="speaker.wave.2" md="volume_up" size={16} color={c.accent} fallback="🔊" />
            <Text style={{ color: c.accent, fontWeight: "700", fontSize: 15 }}>{t.civicsListen}</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: c.heading, lineHeight: 29 }}>
          {q.q}
        </Text>

        {q.kind === "local" ? (
          <View style={{ backgroundColor: c.surface2, borderRadius: radius.md, padding: space(4), gap: space(3) }}>
            <Answers q={q} data={data} />
            {!answered && <Button title={t.civicsGotIt} variant="secondary" onPress={() => choose(null)} />}
          </View>
        ) : (
          <View style={{ gap: space(2.5) }} accessibilityRole="radiogroup">
            {item.choices.map((choice, i) => {
              const isRight = choice === q.right;
              const picked = answered?.choice === choice;
              const tone = answered ? (isRight ? c.st.done : picked ? c.st.stop : null) : null;
              return (
                <Pressable
                  key={choice}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked, disabled: Boolean(answered) }}
                  accessibilityLabel={choice}
                  disabled={Boolean(answered)}
                  onPress={() => choose(choice)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space(3),
                    borderRadius: radius.md,
                    borderWidth: tone ? 2 : StyleSheet.hairlineWidth * 2,
                    borderColor: tone ? tone.fg : c.border,
                    backgroundColor: tone ? tone.bg : pressed ? c.accentSoft : c.surface,
                    paddingHorizontal: space(3.5),
                    paddingVertical: space(3.5),
                    opacity: answered && !tone ? 0.6 : 1,
                  })}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: tone ? tone.fg : c.border, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: tone ? tone.fg : c.muted }}>{answered && isRight ? "✓" : answered && picked ? "✕" : i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: c.text, lineHeight: 22 }}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {answered && q.kind !== "local" && (
          <View style={{ gap: space(3), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: space(4) }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: answered.correct ? c.st.done.fg : c.st.stop.fg }}>{answered.correct ? t.civicsCorrect : t.civicsWrong}</Text>
            <Answers q={q} data={data} />
          </View>
        )}
      </Card>

      {answered && <Button title={finished ? t.civicsSeeResult : t.civicsNext} onPress={next} iconAfter={{ ios: "arrow.right", md: "arrow_forward", fallback: "→" }} />}
      <Button title={t.civicsExit} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
