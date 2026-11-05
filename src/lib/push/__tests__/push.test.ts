import { describe, expect, it } from "vitest";
import { expoPushDriver, getPushDriver, isExpoPushToken } from "..";

describe("push drivers", () => {
  it("recognizes Expo push tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[abcDEF123456xyz]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abcDEF123456xyz]")).toBe(true);
    expect(isExpoPushToken("fcm:abc")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  it("chooses console in development and Expo on production", () => {
    expect(getPushDriver({}).name).toBe("console");
    expect(getPushDriver({ VERCEL_ENV: "production" }).name).toBe("expo");
    expect(getPushDriver({ VERCEL_ENV: "production", PUSH_DRIVER: "console" }).name).toBe("console");
  });

  it("sends to Expo in chunks of 100 and maps dead tokens", async () => {
    const calls: { body: unknown[]; auth: string | null }[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as unknown[];
      calls.push({ body, auth: new Headers(init.headers).get("authorization") });
      return new Response(
        JSON.stringify({
          data: body.map((_, i) =>
            i === 1 ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } : i === 2 ? { status: "error", message: "MessageTooBig" } : { status: "ok", id: "t" },
          ),
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const driver = expoPushDriver({ accessToken: "tok", fetchImpl });
    const msgs = Array.from({ length: 150 }, (_, i) => ({ to: `ExponentPushToken[device${i}xxxxxx]`, title: "t", body: "b" }));
    const r = await driver.send(msgs);
    expect(calls.map((c) => c.body.length)).toEqual([100, 50]);
    expect(calls[0].auth).toBe("Bearer tok");
    expect(r[0]).toEqual({ status: "ok" });
    expect(r[1]).toEqual({ status: "dead" });
    expect(r[2]).toEqual({ status: "error", message: "MessageTooBig" });
    expect(r).toHaveLength(150);
  });
});
