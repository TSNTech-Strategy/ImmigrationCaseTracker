"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  choicesFor,
  CIVICS_LINKS,
  CIVICS_TEXT,
  CIVICS_VERSIONS,
  civicsTest,
  DEFAULT_VERSION,
  isCivicsVersion,
  mockPool,
  outcome,
  PRACTICE_PASS_SHARE,
  shuffle,
  type CivicsQuestion,
  type CivicsVersion,
} from "@/lib/civics";

/**
 * Practice for the naturalization civics test: a mock test that follows the
 * official format (it stops at the passing score or once passing is out of
 * reach) and practice by section. Runs entirely in the browser.
 */

type Item = { q: CivicsQuestion; choices: string[] };
/** correct is null for questions that can't be checked here (they depend on where you live). */
type Answer = { q: CivicsQuestion; choice: string | null; correct: boolean | null };
type Run = { id: number; mode: "mock" | "section"; section?: string; title: string; items: Item[]; answers: Answer[]; index: number };

const STORE = "casepingo.civics";

// Settings (test version, 65/20) are remembered on this device; memory keeps them if storage is blocked.
const listeners = new Set<() => void>();
let memory: string | null = null;
const settingsSnapshot = () => {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(STORE) ?? "";
  } catch {
    return "";
  }
};
const subscribeSettings = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
function writeSettings(value: string) {
  memory = value;
  try {
    localStorage.setItem(STORE, value);
  } catch {
    // Private mode or blocked storage: memory keeps it for this visit.
  }
  listeners.forEach((l) => l());
}
function parseSettings(raw: string): { version: CivicsVersion; senior: boolean } {
  try {
    const saved = JSON.parse(raw || "{}");
    return { version: isCivicsVersion(saved.version) ? saved.version : DEFAULT_VERSION, senior: saved.senior === true };
  } catch {
    return { version: DEFAULT_VERSION, senior: false };
  }
}
const OUTLINE = "rounded-xl border border-[var(--border)] bg-[var(--surface)]";
const PRIMARY = "rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]";
const SECONDARY = "rounded-lg border border-[var(--border)] px-4 py-2.5 font-semibold hover:bg-[var(--surface-2)]";

function Star({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z" />
    </svg>
  );
}

function Speaker() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}

function OfficialLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const noSubscribe = () => () => {};

/** Reads text aloud in English, like the officer would (where the browser supports it). */
function useSpeech() {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, []);
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  return { supported, speak };
}

function AnswerList({ q }: { q: CivicsQuestion }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {q.kind === "local" ? (
        <>
          <p>{CIVICS_TEXT.local.en}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <OfficialLink href={CIVICS_LINKS.senators}>Your U.S. senators</OfficialLink>
            </li>
            <li>
              <OfficialLink href={CIVICS_LINKS.representative}>Your U.S. representative</OfficialLink>
            </li>
            <li>
              <OfficialLink href={CIVICS_LINKS.electedOfficials}>Your governor and state officials</OfficialLink>
            </li>
          </ul>
        </>
      ) : (
        <>
          <p className="font-semibold">{q.pick > 1 ? `Accepted answers (name ${q.pick}):` : q.answers.length > 1 ? "Accepted answers (any one):" : "Accepted answer:"}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {q.answers.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}
      {q.kind === "current" && (
        <p className="text-[var(--muted)]">
          {CIVICS_TEXT.current.en} <OfficialLink href={CIVICS_LINKS.testUpdates}>USCIS test updates</OfficialLink>
        </p>
      )}
      {q.note && q.kind !== "current" && <p className="text-[var(--muted)]">{q.note}</p>}
    </div>
  );
}

export function CivicsPractice() {
  const { version, senior } = parseSettings(useSyncExternalStore(subscribeSettings, settingsSnapshot, () => ""));
  const [run, setRun] = useState<Run | null>(null);
  const runs = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const { supported: canSpeak, speak } = useSpeech();

  const save = (v: CivicsVersion, s: boolean) => writeSettings(JSON.stringify({ version: v, senior: s }));

  const test = civicsTest(version);
  const rules = senior ? test.rules.senior : test.rules.standard;
  const inSection = (key: string) => test.questions.filter((q) => q.section === key && (!senior || q.star));

  const begin = (next: Omit<Run, "id">) => {
    runs.current += 1;
    setRun({ ...next, id: runs.current });
    setShowResult(false);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const startMock = () =>
    begin({
      mode: "mock",
      title: `Mock test: ${test.title.en}${senior ? " (65/20)" : ""}`,
      items: shuffle(mockPool(test.questions, senior))
        .slice(0, rules.ask)
        .map((q) => ({ q, choices: choicesFor(q) })),
      answers: [],
      index: 0,
    });
  const startSection = (key: string) => {
    const s = test.sections.find((x) => x.key === key)!;
    begin({ mode: "section", section: key, title: s.title.en, items: shuffle(inSection(key)).map((q) => ({ q, choices: choicesFor(q) })), answers: [], index: 0 });
  };
  const restart = () => (run?.mode === "mock" ? startMock() : run?.section ? startSection(run.section) : setRun(null));

  const item = run?.items[run.index];
  const answered = run && item ? run.answers.find((a) => a.q.id === item.q.id) : undefined;
  const scored = run ? run.answers.filter((a) => a.correct !== null) : [];
  const right = scored.filter((a) => a.correct).length;
  const decided = run?.mode === "mock" ? outcome(rules, scored.map((a) => Boolean(a.correct))) : null;
  const atEnd = run ? run.index >= run.items.length - 1 : false;
  const finished = Boolean(run && answered && (decided || atEnd));

  const choose = (choice: string | null) => {
    if (!run || !item || answered) return;
    const correct = item.q.kind === "local" ? null : choice === item.q.right;
    setRun({ ...run, answers: [...run.answers, { q: item.q, choice, correct }] });
  };
  const next = () => {
    if (!run) return;
    if (finished) {
      setShowResult(true);
      requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      return;
    }
    setRun({ ...run, index: run.index + 1 });
  };

  // A new question: move focus to it, so keyboard and screen reader users start there.
  const focusKey = run && !showResult ? `${run.id}-${run.index}` : null;
  useEffect(() => {
    if (focusKey) heading.current?.focus({ preventScroll: true });
  }, [focusKey]);

  // Keys 1–4 pick a choice; Enter moves on.
  useEffect(() => {
    if (!run || showResult || !item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= item.choices.length) {
        e.preventDefault();
        choose(item.choices[n - 1]);
      } else if (answered && e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Results ----
  if (run && showResult) {
    const total = scored.length;
    const share = total ? right / total : 0;
    const passed = run.mode === "mock" ? decided === "pass" : share >= PRACTICE_PASS_SHARE;
    const missed = run.answers.filter((a) => a.correct === false);
    return (
      <div ref={top} className="flex scroll-mt-24 flex-col gap-6">
        <div
          className="flex flex-col gap-2 rounded-2xl border p-6"
          style={{ borderColor: passed ? "var(--st-done)" : "var(--st-stop)", background: passed ? "var(--st-done-bg)" : "var(--st-stop-bg)" }}
          role="status"
        >
          <p className="text-sm font-semibold" style={{ color: passed ? "var(--st-done)" : "var(--st-stop)" }}>
            {run.title}
          </p>
          <h2 className="text-3xl font-bold tracking-tight">
            {run.mode === "mock" ? (passed ? "You passed" : "Not this time") : passed ? "Passing score" : "Keep practicing"}
          </h2>
          <p className="text-lg">
            {right} of {total} correct{run.mode === "section" && total ? ` (${Math.round(share * 100)}%)` : ""}.
          </p>
          <p className="text-sm text-[var(--muted)]">
            {run.mode === "mock"
              ? `Like the real test, it stopped at ${rules.pass} right or ${rules.failAt} wrong (you need ${rules.pass} of ${rules.ask}).`
              : `The real test needs ${Math.round(PRACTICE_PASS_SHARE * 100)}% (${rules.pass} of ${rules.ask}).`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={restart} className={PRIMARY}>
            {run.mode === "mock" ? "Take another mock test" : "Practice this section again"}
          </button>
          <button type="button" onClick={() => setRun(null)} className={SECONDARY}>
            All practice
          </button>
        </div>
        {missed.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="missed">
            <h3 id="missed" className="text-lg font-semibold">
              Review what you missed
            </h3>
            {missed.map((a) => (
              <div key={a.q.id} className={`${OUTLINE} flex flex-col gap-2 p-4`}>
                <p className="text-xs font-semibold text-[var(--muted)]">Question {a.q.n}</p>
                <p className="font-semibold">{a.q.q}</p>
                <p className="text-sm">
                  You chose: <span className="text-[var(--st-stop)]">{a.choice}</span>
                </p>
                <AnswerList q={a.q} />
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  // ---- A question ----
  if (run && item) {
    const q = item.q;
    const progress = run.mode === "mock" ? Math.min(1, run.answers.length / rules.ask) : run.answers.length / run.items.length;
    return (
      <div ref={top} className="flex scroll-mt-24 flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold text-[var(--brand-red-text)]">{run.title}</p>
            <p className="text-sm text-[var(--muted)]" aria-live="polite">
              {run.mode === "mock"
                ? `Question ${run.index + 1} of up to ${rules.ask} · ${right} right · ${scored.length - right} wrong · pass at ${rules.pass}`
                : `Question ${run.index + 1} of ${run.items.length} · ${right} right`}
            </p>
          </div>
          <button type="button" onClick={() => setRun(null)} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]">
            Exit
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className={`${OUTLINE} flex flex-col gap-5 p-5 shadow-[var(--shadow)] sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
              Question {q.n}
              {q.star && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--st-action-bg)] px-2 py-0.5 text-[var(--st-action)]" title="On the 65/20 list">
                  <Star /> 65/20
                </span>
              )}
            </p>
            {canSpeak && (
              <button
                type="button"
                onClick={() => speak(q.q)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <Speaker /> Listen
              </button>
            )}
          </div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-bold leading-snug outline-none sm:text-2xl">
            {q.q}
          </h2>

          {q.kind === "local" ? (
            <div className="flex flex-col gap-3 rounded-lg bg-[var(--surface-2)] p-4">
              <AnswerList q={q} />
              {!answered && (
                <button type="button" onClick={() => choose(null)} className={`${SECONDARY} self-start bg-[var(--surface)]`}>
                  Got it
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5" role="group" aria-label="Choices">
              {item.choices.map((c, i) => {
                const isRight = c === q.right;
                const picked = answered?.choice === c;
                const tone = !answered ? "" : isRight ? "done" : picked ? "stop" : "";
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={Boolean(answered)}
                    aria-pressed={picked}
                    onClick={() => choose(c)}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 text-left font-medium transition-colors enabled:hover:border-[var(--accent)] enabled:hover:bg-[var(--accent-soft)] disabled:cursor-default"
                    style={
                      tone
                        ? { borderColor: `var(--st-${tone})`, background: `var(--st-${tone}-bg)` }
                        : { borderColor: "var(--border)", opacity: answered ? 0.75 : 1 }
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                      style={{ borderColor: tone ? `var(--st-${tone})` : "var(--border)", color: tone ? `var(--st-${tone})` : "var(--muted)" }}
                    >
                      {answered && isRight ? "✓" : answered && picked ? "✕" : i + 1}
                    </span>
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div aria-live="polite">
            {answered && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                {answered.correct !== null && (
                  <p className="text-lg font-semibold" style={{ color: answered.correct ? "var(--st-done)" : "var(--st-stop)" }}>
                    {answered.correct ? "Correct!" : "Not quite."}
                  </p>
                )}
                {q.kind !== "local" && <AnswerList q={q} />}
              </div>
            )}
          </div>
        </div>

        {answered && (
          <button type="button" onClick={next} className={`${PRIMARY} self-start`}>
            {finished ? "See your result" : "Next question"}
          </button>
        )}
      </div>
    );
  }

  // ---- Start ----
  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Which test will you take?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {CIVICS_VERSIONS.map((v) => {
            const t = civicsTest(v);
            const on = v === version;
            return (
              <label
                key={v}
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"}`}
              >
                <input type="radio" name="civics-version" value={v} checked={on} onChange={() => save(v, senior)} className="mt-1 accent-[var(--accent)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">
                    {t.title.en} · {t.total} questions
                  </span>
                  <span className="text-sm text-[var(--muted)]">{t.who.en}</span>
                </span>
              </label>
            );
          })}
        </div>
        <label className="mt-1 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={senior} onChange={(e) => save(version, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-semibold">I&apos;m 65 or older and have been a permanent resident for 20+ years (65/20).</span>{" "}
            <span className="text-[var(--muted)]">Practice only the 20 starred questions.</span>
          </span>
        </label>
      </fieldset>

      <div className={`${OUTLINE} flex flex-col gap-4 p-6 shadow-[var(--shadow)] sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Mock test</h2>
          <p className="text-sm text-[var(--muted)]">{senior ? CIVICS_TEXT.senior.en : test.format.en}</p>
        </div>
        <button type="button" onClick={startMock} className={`${PRIMARY} whitespace-nowrap`}>
          Start mock test
        </button>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="by-section">
        <h2 id="by-section" className="text-lg font-semibold">
          Practice by section
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {test.sections.map((s) => {
            const count = inSection(s.key).length;
            return (
              <button
                key={s.key}
                type="button"
                disabled={count === 0}
                onClick={() => startSection(s.key)}
                className={`${OUTLINE} group flex items-center justify-between gap-3 p-4 text-left transition-colors enabled:hover:border-[var(--accent)] disabled:opacity-60`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{s.group.en}</span>
                  <span className="font-semibold">{s.title.en}</span>
                  <span className="text-sm text-[var(--muted)]">{count === 0 ? "No starred questions" : `${count} question${count === 1 ? "" : "s"}`}</span>
                </span>
                {count > 0 && (
                  <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-[var(--muted)]">
        {CIVICS_TEXT.spoken.en} <OfficialLink href={test.listUrl}>Official list (PDF)</OfficialLink> ·{" "}
        <OfficialLink href={CIVICS_LINKS.testUpdates}>Test updates</OfficialLink>
      </p>
    </div>
  );
}
