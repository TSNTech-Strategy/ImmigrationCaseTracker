import { fetch as expoFetch } from "expo/fetch";
import { api } from "./api";
import { config } from "./config";
import { supabase } from "./supabase";

/**
 * The CasePingo assistant (docs/MOBILE-API.md): GET /api/v1/assistant for the
 * daily questions left, POST to ask. Answers stream as newline-delimited JSON,
 * read with expo/fetch (the built-in fetch can't stream on phones).
 */

export type AssistantStatus = { available: boolean; plan: "FREE" | "PREMIUM"; limit: number; used: number; remaining: number };
export type ChatTurn = { role: "user" | "assistant"; content: string };

export const loadAssistantStatus = () => api<AssistantStatus>("/api/v1/assistant");

export type AskHandlers = {
  text: (piece: string) => void;
  /** Throw away the text so far (a fallback model took over). */
  reset: () => void;
  refusal: () => void;
  done: (remaining: number | null) => void;
  /** error: offline, unavailable, invalid, too_long, limit, busy, failed. */
  error: (error: string, message: string) => void;
};

export async function askAssistant(messages: ChatTurn[], caseId: string | null, signal: AbortSignal, on: AskHandlers): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Awaited<ReturnType<typeof expoFetch>>;
  try {
    res = await expoFetch(`${config.apiUrl}/api/v1/assistant`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/x-ndjson", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, ...(caseId ? { caseId } : {}) }),
      signal,
    });
  } catch {
    if (!signal.aborted) on.error("offline", "");
    return;
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    on.error(body.error ?? "failed", body.message ?? "");
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const e = JSON.parse(line) as { type: string; text?: string; remaining?: number; error?: string; message?: string };
        if (e.type === "text") on.text(e.text ?? "");
        else if (e.type === "reset") on.reset();
        else if (e.type === "refusal") on.refusal();
        else if (e.type === "done") on.done(typeof e.remaining === "number" ? e.remaining : null);
        else if (e.type === "error") on.error(e.error ?? "failed", e.message ?? "");
      }
    }
  } catch {
    if (!signal.aborted) on.error("offline", "");
  }
}
