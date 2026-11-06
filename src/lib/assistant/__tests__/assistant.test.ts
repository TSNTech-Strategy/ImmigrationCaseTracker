/** The assistant: conversation checks, the prompt, daily limits and the streamed reply (database parts need TEST_DATABASE_URL). */
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PLAN_LIMITS } from "@/lib/plans";
import { CHAT_LIMITS, parseAsk } from "../conversation";
import { assistantKnowledge } from "../knowledge";
import { assistantSystem, contextBlock, redactReceipts } from "../prompt";
import { askAssistant, assistantStatus, type AssistantDeps } from "../service";
import { questionsUsed, refundQuestion, reserveQuestion, utcDay } from "../usage";

const url = process.env.TEST_DATABASE_URL;
const q = (content: string) => ({ role: "user" as const, content });
const a = (content: string) => ({ role: "assistant" as const, content });

describe("conversation checks", () => {
  it("accepts a question, with or without earlier turns, and a case id", () => {
    expect(parseAsk({ messages: [q(" What does Case Was Received mean? ")] })).toEqual({ ok: true, messages: [q("What does Case Was Received mean?")], caseId: null });
    const r = parseAsk({ messages: [q("hi"), a("Hello!"), q("And next?")], caseId: "ckabc123def456" });
    expect(r).toMatchObject({ ok: true, caseId: "ckabc123def456" });
  });

  it("rejects anything that isn't a conversation ending with a question", () => {
    for (const body of [null, {}, { messages: [] }, { messages: [a("hi")] }, { messages: [q("hi"), a("there")] }, { messages: [q("a"), q("b")] }, { messages: [{ role: "system", content: "x" }] }, { messages: [q("")] }]) {
      expect(parseAsk(body).ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("limits question length, drops old turns, and ignores odd case ids", () => {
    expect(parseAsk({ messages: [q("x".repeat(CHAT_LIMITS.questionChars + 1))] })).toMatchObject({ ok: false, error: "too_long" });
    const long = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? q(`question ${i}`) : a(`answer ${i}`)));
    long.push(q("last"));
    const r = parseAsk({ messages: long, caseId: "../../etc" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.messages.length).toBeLessThanOrEqual(CHAT_LIMITS.messages);
    expect(r.messages[0].role).toBe("user");
    expect(r.messages.at(-1)).toEqual(q("last"));
    expect(r.caseId).toBeNull();
    const big = parseAsk({ messages: [q("a"), a("b".repeat(5000)), q("c"), a("d".repeat(5000)), q("e"), a("f".repeat(5000)), q("g"), a("h".repeat(5000)), q("i"), a("j".repeat(5000)), q("k")] });
    if (!big.ok) throw new Error("expected ok");
    expect(big.messages.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(CHAT_LIMITS.totalChars);
  });
});

describe("prompt", () => {
  it("grounds the assistant in CasePingo's content, the same every time", () => {
    const k = assistantKnowledge();
    expect(assistantKnowledge()).toBe(k);
    for (const text of ["Case Was Received", "Request for Evidence", "Processing times", "Interviews", "2025 civics test", "Visa Bulletin", "Premium", "egov.uscis.gov"]) {
      expect(k, text).toContain(text);
    }
    expect(k).toContain(`${PLAN_LIMITS.FREE.assistantPerDay} assistant questions a day`);
    expect(k).toMatch(/38\.\* What is the name of the President of the United States now\? — /);
    const system = assistantSystem();
    expect(system).toContain("never legal advice");
    expect(system).toContain("find-legal-services");
    expect(system).not.toMatch(/Today is/);
    expect(system.length).toBeLessThan(90_000);
  });

  it("adds today's date, the language and the case, never a receipt number", () => {
    const block = contextBlock({
      today: new Date("2026-11-06T12:00:00Z"),
      lang: "es",
      plan: "Free",
      caseInfo: {
        formCode: "I-485",
        formName: "Application to Register Permanent Residence or Adjust Status",
        statusTitle: "Case Was Received",
        statusDescription: "On October 1, 2026, we received your Form I-485, Receipt Number IOE0123456789, and sent you the receipt notice.",
        uscisDate: "October 1, 2026",
        lastCheckedAt: new Date("2026-11-06T08:00:00Z"),
        paused: false,
      },
    });
    expect(block).toContain("Today is November 6, 2026.");
    expect(block).toContain("Spanish");
    expect(block).toContain('"Case Was Received"');
    expect(block).toContain("I-485, Application to Register");
    expect(block).not.toContain("IOE0123456789");
    expect(redactReceipts("EAC9999103402 and IOE0123456789")).toBe("[receipt number] and [receipt number]");
  });
});

/** A stand-in for the Claude client: plays back stream events. */
function fakeClaude(script: { events?: unknown[]; stop?: string; error?: Error; errorAfter?: number }) {
  const calls: { params: Record<string, unknown> }[] = [];
  const client = {
    stream(params: Record<string, unknown>) {
      calls.push({ params });
      const events = script.events ?? [];
      return {
        async *[Symbol.asyncIterator]() {
          for (let i = 0; i < events.length; i++) {
            if (script.error && script.errorAfter === i) throw script.error;
            yield events[i];
          }
          if (script.error && (script.errorAfter ?? events.length) >= events.length) throw script.error;
        },
        finalMessage: async () => ({ stop_reason: script.stop ?? "end_turn", usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 } }),
      };
    },
  };
  return { client: client as unknown as AssistantDeps["client"], calls };
}
const text = (t: string) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } });
const lines = async (res: Response) =>
  (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe.skipIf(!url)("assistant with a database", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const clock = new Date("2031-03-03T10:00:00Z");
  const users: string[] = [];
  const makeUser = async (plan: "FREE" | "PREMIUM" = "FREE") => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `a-${id}@assistant-test.dev`, plan } });
    users.push(id);
    return { id, locale: "en" };
  };
  const deps = (client: AssistantDeps["client"], logs: Record<string, unknown>[] = []): AssistantDeps => ({ db, client, now: () => clock, log: (e) => logs.push(e) });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("counts questions per day up to the limit, atomically, and gives one back", async () => {
    const u = await makeUser();
    const results = await Promise.all(Array.from({ length: 8 }, () => reserveQuestion(db, u.id, 5, clock)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(await questionsUsed(db, u.id, clock)).toBe(5);
    await refundQuestion(db, u.id, clock);
    expect(await questionsUsed(db, u.id, clock)).toBe(4);
    expect(await questionsUsed(db, u.id, new Date(clock.getTime() + 24 * 3600_000))).toBe(0);
    expect(utcDay(clock)).toBe("2031-03-03");
  });

  it("clears counts older than 30 days", async () => {
    const u = await makeUser();
    await db.assistantUsage.create({ data: { userId: u.id, day: "2031-01-01", count: 3 } });
    await reserveQuestion(db, u.id, 5, clock);
    expect(await db.assistantUsage.count({ where: { userId: u.id } })).toBe(1);
  });

  it("streams an answer grounded in the prompt, then says how many questions are left", async () => {
    const u = await makeUser();
    const logs: Record<string, unknown>[] = [];
    const { client, calls } = fakeClaude({ events: [{ type: "message_start" }, text("It means USCIS "), text("has your case.")] });
    const res = await askAssistant(deps(client, logs), u, { messages: [q("What does Case Was Received mean?")] });
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await lines(res)).toEqual([
      { type: "text", text: "It means USCIS " },
      { type: "text", text: "has your case." },
      { type: "done", remaining: PLAN_LIMITS.FREE.assistantPerDay - 1, stop: "end_turn" },
    ]);
    const params = calls[0].params as { model: string; fallbacks: string; system: { text: string; cache_control?: unknown }[]; messages: unknown[] };
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0].text).toContain("Case Was Received");
    expect(params.system[1].text).toContain("Today is March 3, 2031.");
    expect(params.messages).toEqual([q("What does Case Was Received mean?")]);
    expect(logs[0]).toMatchObject({ event: "assistant.answer", cacheRead: 9000 });
    expect(JSON.stringify(logs)).not.toContain("Case Was Received");
  });

  it("adds the person's own case, and only their own", async () => {
    const u = await makeUser("PREMIUM");
    const other = await makeUser();
    const mine = await db.trackedCase.create({
      data: { ownerUserId: u.id, receiptEncrypted: "x", receiptDigest: randomUUID(), receiptMasked: "IOE*******789", formType: "I-485", statusTitleEn: "Interview Was Scheduled", statusDescriptionEn: "Your interview is scheduled. Receipt Number IOE5550001234." },
    });
    const { client, calls } = fakeClaude({ events: [text("ok")] });
    await lines(await askAssistant(deps(client), u, { messages: [q("What now?")], caseId: mine.id }));
    expect(calls[0].params.system).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('"Interview Was Scheduled"') })]));
    expect(JSON.stringify(calls[0].params)).not.toContain("IOE5550001234");
    expect(JSON.stringify(calls[0].params)).toContain("Your interview is scheduled. Receipt Number [receipt number].");
    await lines(await askAssistant(deps(client), other, { messages: [q("What now?")], caseId: mine.id }));
    const otherContext = (calls[1].params.system as { text: string }[])[1].text;
    expect(otherContext).not.toContain("one of their cases");
    expect(otherContext).not.toContain("Interview Was Scheduled");
  });

  it("stops at the daily limit with a clear message", async () => {
    const u = await makeUser();
    await db.assistantUsage.create({ data: { userId: u.id, day: utcDay(clock), count: PLAN_LIMITS.FREE.assistantPerDay } });
    const { client, calls } = fakeClaude({ events: [text("never")] });
    const res = await askAssistant(deps(client), u, { messages: [q("One more?")] });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "limit", plan: "FREE", limit: PLAN_LIMITS.FREE.assistantPerDay });
    expect(calls).toHaveLength(0);
    expect(await assistantStatus(deps(client), u)).toMatchObject({ available: true, remaining: 0 });
  });

  it("gives the question back when Claude fails before answering, and says it's busy", async () => {
    const u = await makeUser();
    const { client } = fakeClaude({ error: new Anthropic.APIConnectionError({ message: "down" }) });
    const events = await lines(await askAssistant(deps(client), u, { messages: [q("Hello?")] }));
    expect(events).toEqual([{ type: "error", error: "busy", message: expect.stringContaining("busy") }]);
    expect(await questionsUsed(db, u.id, clock)).toBe(0);
  });

  it("keeps the count when an answer was cut off midway", async () => {
    const u = await makeUser();
    const { client } = fakeClaude({ events: [text("Part one"), text(" part two")], error: new Error("boom"), errorAfter: 1 });
    const events = await lines(await askAssistant(deps(client), u, { messages: [q("Hello?")] }));
    expect(events[0]).toEqual({ type: "text", text: "Part one" });
    expect(events.at(-1)).toMatchObject({ type: "error", error: "failed" });
    expect(await questionsUsed(db, u.id, clock)).toBe(1);
  });

  it("tells the client to start over when a fallback model takes over, and reports refusals", async () => {
    const u = await makeUser();
    const { client } = fakeClaude({ events: [text("Partial"), { type: "content_block_start", index: 1, content_block: { type: "fallback" } }, text("Fresh answer")] });
    expect(await lines(await askAssistant(deps(client), u, { messages: [q("Hi")] }))).toEqual([
      { type: "text", text: "Partial" },
      { type: "reset" },
      { type: "text", text: "Fresh answer" },
      { type: "done", remaining: PLAN_LIMITS.FREE.assistantPerDay - 1, stop: "end_turn" },
    ]);
    const declined = fakeClaude({ events: [], stop: "refusal" });
    expect((await lines(await askAssistant(deps(declined.client), u, { messages: [q("Hi")] }))).map((e) => e.type)).toEqual(["refusal", "done"]);
  });

  it("says it isn't available without an API key, and rejects bad input before counting", async () => {
    const u = await makeUser();
    const off = await askAssistant(deps(null), u, { messages: [q("Hi")] });
    expect(off.status).toBe(503);
    expect(await off.json()).toMatchObject({ error: "unavailable" });
    const { client } = fakeClaude({ events: [text("x")] });
    const bad = await askAssistant(deps(client), u, { messages: [a("no question")] });
    expect(bad.status).toBe(400);
    expect(await questionsUsed(db, u.id, clock)).toBe(0);
    expect(await assistantStatus(deps(null), u)).toMatchObject({ available: false, limit: PLAN_LIMITS.FREE.assistantPerDay, remaining: PLAN_LIMITS.FREE.assistantPerDay });
  });

  it("gives law firm members Premium's limit", async () => {
    const u = await makeUser();
    const firm = await db.firm.create({ data: { name: "Test Firm LLP" } });
    await db.firmMembership.create({ data: { firmId: firm.id, userId: u.id, role: "STAFF" } });
    expect((await assistantStatus(deps(null), u)).limit).toBe(PLAN_LIMITS.PREMIUM.assistantPerDay);
    await db.firm.delete({ where: { id: firm.id } });
  });
});
