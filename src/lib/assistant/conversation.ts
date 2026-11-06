/**
 * The conversation the client sends with each question. Conversations aren't
 * stored: the website and app keep them on screen and send the recent turns
 * back, which this checks and trims before they reach the model.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const CHAT_LIMITS = {
  /** Most recent messages sent to the model. */
  messages: 20,
  /** Longest question a person can send. */
  questionChars: 2000,
  /** Longest earlier answer kept (longer ones are cut). */
  answerChars: 6000,
  /** All messages together. Older turns are dropped first. */
  totalChars: 24000,
  /** Largest request body read. */
  bodyBytes: 100_000,
} as const;

export type ParsedAsk = { ok: true; messages: ChatMessage[]; caseId: string | null } | { ok: false; error: "invalid" | "too_long"; message: string };

const invalid = { ok: false, error: "invalid", message: "Something went wrong with that message. Please start a new conversation." } as const;

export function parseAsk(body: unknown): ParsedAsk {
  if (!body || typeof body !== "object") return invalid;
  const { messages, caseId } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) return invalid;

  const clean: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return invalid;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return invalid;
    const text = content.trim();
    if (!text) return invalid;
    clean.push({ role, content: role === "assistant" ? text.slice(0, CHAT_LIMITS.answerChars) : text });
  }

  const last = clean[clean.length - 1];
  if (last.role !== "user") return invalid;
  if (last.content.length > CHAT_LIMITS.questionChars) {
    return { ok: false, error: "too_long", message: `Please keep your question under ${CHAT_LIMITS.questionChars.toLocaleString("en-US")} characters.` };
  }

  // Recent turns only, starting with a question, taking turns.
  let recent = clean.slice(-CHAT_LIMITS.messages);
  while (recent.length && recent[0].role !== "user") recent = recent.slice(1);
  if (recent.some((m, i) => m.role !== (i % 2 === 0 ? "user" : "assistant"))) return invalid;
  if (recent.some((m) => m.role === "user" && m.content.length > CHAT_LIMITS.questionChars)) {
    recent = recent.map((m) => (m.role === "user" ? { ...m, content: m.content.slice(0, CHAT_LIMITS.questionChars) } : m));
  }
  const size = (ms: ChatMessage[]) => ms.reduce((n, m) => n + m.content.length, 0);
  while (recent.length > 1 && size(recent) > CHAT_LIMITS.totalChars) recent = recent.slice(2);

  return { ok: true, messages: recent, caseId: typeof caseId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(caseId) ? caseId : null };
}

/** Read a JSON body up to the size limit; anything else counts as empty. */
export async function readAskBody(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > CHAT_LIMITS.bodyBytes) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
