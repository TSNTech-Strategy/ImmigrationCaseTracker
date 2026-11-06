"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The CasePingo assistant on the website: a chat that streams answers from
 * POST /api/assistant. The conversation lives only on this page (nothing is
 * stored); each question sends the recent turns back.
 */

type Turn = { id: number; role: "user" | "assistant"; content: string; state?: "streaming" | "done" | "stopped" | "error" | "refused" };
type CaseRef = { id: string; label: string };

const GENERAL = ["What does “Case Was Received” mean?", "What should I bring to my green card interview?", "How does the 2025 civics test work?", "How do I read the Visa Bulletin?"];
const ABOUT_CASE = ["What does my current status mean?", "What usually happens next?", "Is there anything I should do now?"];

function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

/** Plain text with links: full URLs become links (new tab, so the chat stays open). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-[var(--accent)] underline underline-offset-2">
            {p.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-fg)]">{turn.content}</p>
      </div>
    );
  }
  const waiting = turn.state === "streaming" && !turn.content;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Sparkle size={15} />
      </span>
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow)]">
        {waiting ? (
          <p className="flex items-center gap-1 py-1 text-[var(--muted)]" aria-label="The assistant is writing">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <RichText text={turn.content} />
            {turn.state === "streaming" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[var(--muted)] align-middle" aria-hidden="true" />}
          </p>
        )}
        {turn.state === "stopped" && <p className="mt-1 text-xs text-[var(--muted)]">Stopped.</p>}
      </div>
    </div>
  );
}

export function AssistantChat({
  available,
  remaining: initialRemaining,
  limit,
  plan,
  caseRef,
}: {
  available: boolean;
  remaining: number;
  limit: number;
  plan: "FREE" | "PREMIUM";
  caseRef: CaseRef | null;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [problem, setProblem] = useState<{ message: ReactNode; retry?: string } | null>(null);
  const [aboutCase, setAboutCase] = useState<CaseRef | null>(caseRef);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Keep the newest text in view while it streams.
  const last = turns[turns.length - 1];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, last?.content.length]);

  const update = (id: number, change: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? change(t) : t)));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setProblem(null);
    // Earlier turns that got an answer, then the new question.
    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i + 1 < turns.length; i++) {
      const [qt, at] = [turns[i], turns[i + 1]];
      if (qt.role === "user" && at.role === "assistant" && at.content.trim() && at.state !== "refused") {
        history.push({ role: "user", content: qt.content }, { role: "assistant", content: at.content });
        i++;
      }
    }
    const userTurn: Turn = { id: nextId.current++, role: "user", content: text };
    const answer: Turn = { id: nextId.current++, role: "assistant", content: "", state: "streaming" };
    // A failed question is replaced by the new one.
    setTurns((ts) => [...ts.filter((t) => t.state !== "error"), userTurn, answer]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: text }], caseId: aboutCase?.id }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setTurns((ts) => ts.filter((t) => t.id !== answer.id).map((t) => (t.id === userTurn.id ? { ...t, state: "error" } : t)));
        if (body.error === "limit") {
          setRemaining(0);
          setProblem({
            message: (
              <>
                {body.message}{" "}
                {plan === "FREE" && (
                  <Link href="/settings#plan-h" className="font-semibold underline underline-offset-2">
                    See Premium
                  </Link>
                )}
              </>
            ),
          });
        } else {
          setProblem({ message: body.message ?? "Something went wrong. Please try again.", retry: body.error === "too_long" ? undefined : text });
          if (body.error === "too_long") setDraft(text);
        }
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; text?: string; remaining?: number; message?: string };
          if (event.type === "text") update(answer.id, (t) => ({ ...t, content: t.content + (event.text ?? "") }));
          else if (event.type === "reset") update(answer.id, (t) => ({ ...t, content: "" }));
          else if (event.type === "refusal")
            update(answer.id, (t) => ({ ...t, content: "I can't help with that question. Try asking it another way, or check uscis.gov.", state: "refused" }));
          else if (event.type === "done") {
            if (typeof event.remaining === "number") setRemaining(event.remaining);
            update(answer.id, (t) => ({ ...t, state: t.state === "refused" ? "refused" : "done" }));
          } else if (event.type === "error") {
            update(answer.id, (t) => (t.content ? { ...t, state: "stopped" } : t));
            setTurns((ts) => ts.filter((t) => !(t.id === answer.id && !t.content)).map((t) => (t.id === userTurn.id ? { ...t, state: "error" } : t)));
            setProblem({ message: event.message ?? "Something went wrong. Please try again.", retry: text });
          }
        }
      }
    } catch {
      if (controller.signal.aborted) {
        update(answer.id, (t) => ({ ...t, state: "stopped" }));
        setTurns((ts) => ts.filter((t) => !(t.id === answer.id && !t.content)));
      } else {
        setTurns((ts) => ts.filter((t) => t.id !== answer.id || t.content).map((t) => (t.id === userTurn.id ? { ...t, state: "error" } : t)));
        setProblem({ message: "We couldn't reach CasePingo. Check your connection and try again.", retry: text });
      }
    } finally {
      setBusy(false);
      abort.current = null;
      requestAnimationFrame(() => input.current?.focus());
    }
  }

  const newChat = () => {
    abort.current?.abort();
    setTurns([]);
    setProblem(null);
    input.current?.focus();
  };

  if (!available) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkle size={24} />
        </span>
        <p className="text-lg font-semibold">The assistant is almost ready</p>
        <p className="max-w-md text-sm text-[var(--muted)]">
          It isn&apos;t available yet. In the meantime, the{" "}
          <Link href="/status-guide" className="underline underline-offset-2">
            status library
          </Link>{" "}
          and{" "}
          <Link href="/resources" className="underline underline-offset-2">
            guides
          </Link>{" "}
          answer the most common questions.
        </p>
      </div>
    );
  }

  const suggestions = aboutCase ? ABOUT_CASE : GENERAL;
  return (
    <div className="flex flex-1 flex-col gap-4">
      {turns.length === 0 ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkle size={22} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">{aboutCase ? "Ask about this case" : "How can I help?"}</p>
            <p className="text-sm text-[var(--muted)]">
              Questions about USCIS statuses, what comes next, interviews, the civics test or the Visa Bulletin, answered from CasePingo&apos;s guides. In English
              or Spanish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                disabled={busy || remaining <= 0}
                className="rounded-full border border-[var(--border)] px-3.5 py-2 text-left text-sm font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy={busy}>
          {turns.map((t) => (
            <Bubble key={t.id} turn={t} />
          ))}
        </div>
      )}

      {problem && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)]">
          <span>{problem.message}</span>
          {problem.retry && (
            <button type="button" onClick={() => ask(problem.retry!)} className="font-semibold underline underline-offset-2">
              Try again
            </button>
          )}
        </div>
      )}
      <div ref={end} />

      <form
        className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 pb-4 pt-3 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        {aboutCase && (
          <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">About: {aboutCase.label}</span>
            <button type="button" onClick={() => setAboutCase(null)} className="underline underline-offset-2">
              Ask in general instead
            </button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-question" className="sr-only">
            Your question
          </label>
          <textarea
            id="assistant-question"
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(draft);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={remaining > 0 ? "Ask a question…" : "No questions left today"}
            disabled={remaining <= 0}
            className="max-h-40 min-h-[46px] flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
          />
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()} className="h-[46px] rounded-xl border border-[var(--border)] px-4 font-semibold hover:bg-[var(--surface-2)]">
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || remaining <= 0}
              className="h-[46px] rounded-xl bg-[var(--accent)] px-4 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>
            {remaining} of {limit} questions left today · General information, not legal advice. Don&apos;t share your A-Number or other ID numbers.
          </span>
          {turns.length > 0 && (
            <button type="button" onClick={newChat} className="font-medium underline underline-offset-2">
              New conversation
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
