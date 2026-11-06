import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import { formInfo } from "@/lib/case-insights";
import { parseAsk } from "./conversation";
import { assistantSystem, contextBlock, type CaseContext } from "./prompt";
import { assistantAllowance, questionsUsed, refundQuestion, reserveQuestion } from "./usage";

/**
 * The CasePingo assistant: answers questions with Claude, grounded in
 * CasePingo's own content (./knowledge.ts), streaming the reply as it's
 * written. Used by POST /api/assistant (website) and POST /api/v1/assistant
 * (app). Needs ANTHROPIC_API_KEY on the server; without it the assistant says
 * it isn't available yet.
 *
 * Reply stream: newline-delimited JSON, one event per line:
 *   {"type":"text","text":"..."}        the next piece of the answer
 *   {"type":"reset"}                    discard the text so far (a fallback model takes over)
 *   {"type":"done","remaining":4,"stop":"end_turn"}
 *   {"type":"refusal"}                  the model declined this question
 *   {"type":"error","error":"busy","message":"..."}
 * Errors before any text are plain JSON with an HTTP status and an `error` code
 * (unavailable, invalid, too_long, limit).
 */

export const ASSISTANT_MODEL = "claude-opus-5-5";
/** Room for a short answer plus the model's own (brief, low-effort) thinking. */
const MAX_TOKENS = 4096;

type Db = Pick<PrismaClient, "$queryRaw" | "assistantUsage" | "user" | "firmMembership" | "trackedCase">;
type Streamer = Pick<Anthropic["beta"]["messages"], "stream">;

export type AssistantDeps = {
  db: Db;
  /** The Claude client, or null when the server has no API key. */
  client: Streamer | null;
  now?: () => Date;
  log?: (event: Record<string, unknown>) => void;
};

export type AssistantUser = { id: string; locale: string };

export function claudeClient(env: Record<string, string | undefined> = process.env): Streamer | null {
  const key = env.ANTHROPIC_API_KEY?.trim();
  return key ? new Anthropic({ apiKey: key, maxRetries: 1, timeout: 55_000 }).beta.messages : null;
}

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function assistantStatus(deps: AssistantDeps, user: AssistantUser) {
  const now = (deps.now ?? (() => new Date()))();
  const { plan, limit } = await assistantAllowance(deps.db, user.id);
  const used = await questionsUsed(deps.db, user.id, now);
  return { available: deps.client !== null, plan, limit, used: Math.min(used, limit), remaining: Math.max(0, limit - used) };
}

async function caseContext(db: Db, userId: string, caseId: string): Promise<CaseContext | null> {
  const c = await db.trackedCase.findFirst({
    where: { id: caseId, ownerUserId: userId },
    select: { formType: true, statusTitleEn: true, statusDescriptionEn: true, uscisModifiedRaw: true, lastCheckedAt: true, trackingStatus: true },
  });
  if (!c) return null;
  const form = formInfo(c.formType);
  return {
    formCode: form?.code ?? null,
    formName: form?.name?.en ?? null,
    statusTitle: c.statusTitleEn,
    statusDescription: c.statusDescriptionEn,
    uscisDate: c.uscisModifiedRaw,
    lastCheckedAt: c.lastCheckedAt,
    paused: c.trackingStatus !== "ACTIVE",
  };
}

/** Answer one question. Returns a JSON error, or the streamed reply. */
export async function askAssistant(deps: AssistantDeps, user: AssistantUser, body: unknown, signal?: AbortSignal): Promise<Response> {
  const log = deps.log ?? ((e) => console.log(JSON.stringify(e)));
  if (!deps.client) return json(503, { error: "unavailable", message: "The assistant isn't available yet. Please check back soon." });

  const parsed = parseAsk(body);
  if (!parsed.ok) return json(400, { error: parsed.error, message: parsed.message });

  const now = (deps.now ?? (() => new Date()))();
  const { plan, limit } = await assistantAllowance(deps.db, user.id);
  const reserved = await reserveQuestion(deps.db, user.id, limit, now);
  if (!reserved.ok) {
    return json(429, {
      error: "limit",
      plan,
      limit,
      message:
        plan === "FREE"
          ? `You've used today's ${limit} questions on the Free plan. Premium includes more questions every day. Your questions reset at midnight UTC.`
          : `You've used today's ${limit} questions. They reset at midnight UTC.`,
    });
  }
  const remaining = Math.max(0, limit - reserved.used);
  const caseInfo = parsed.caseId ? await caseContext(deps.db, user.id, parsed.caseId) : null;
  const lang = user.locale === "es" ? "es" : "en";
  const client = deps.client;

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let wrote = false;
      try {
        const stream = client.stream(
          {
            model: ASSISTANT_MODEL,
            max_tokens: MAX_TOKENS,
            // If a safety check declines the question, Anthropic retries it on its recommended model.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            // Short answers to everyday questions: low effort keeps them quick.
            output_config: { effort: "low" },
            system: [
              { type: "text", text: assistantSystem(), cache_control: { type: "ephemeral" } },
              { type: "text", text: contextBlock({ today: now, lang, plan: plan === "PREMIUM" ? "Premium" : "Free", caseInfo }) },
            ],
            messages: parsed.messages,
          },
          { signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "fallback") {
            send({ type: "reset" });
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            wrote = true;
            send({ type: "text", text: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") send({ type: "refusal" });
        send({ type: "done", remaining, stop: final.stop_reason });
        log({
          event: "assistant.answer",
          stop: final.stop_reason,
          input: final.usage.input_tokens,
          cacheRead: final.usage.cache_read_input_tokens,
          cacheWrite: final.usage.cache_creation_input_tokens,
          output: final.usage.output_tokens,
          withCase: Boolean(caseInfo),
        });
      } catch (err) {
        if (!wrote) await refundQuestion(deps.db, user.id, now).catch(() => {});
        if (err instanceof Anthropic.APIUserAbortError || signal?.aborted) {
          // The person stopped the answer or left; nothing to tell them.
        } else {
          const busy = err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError;
          log({ event: "assistant.error", kind: err instanceof Anthropic.APIError ? `${err.status ?? "connection"}` : "unknown", busy });
          send({
            type: "error",
            error: busy ? "busy" : "failed",
            message: busy ? "The assistant is busy right now. Please try again in a minute." : "Something went wrong. Please try again.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed (the person left).
        }
      }
    },
  });

  return new Response(body$, {
    status: 200,
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
