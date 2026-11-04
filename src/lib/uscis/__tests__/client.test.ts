import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCaseStatus } from "../client";
import type { UscisConfig } from "../config";
import { UscisError } from "../errors";
import { clearUscisTokenCache } from "../token";
import { errorBody, noHistoryBody, tokenBody, withHistoryBody } from "./fixtures";

const config: UscisConfig = {
  env: "sandbox",
  baseUrl: "https://api-int.uscis.gov",
  clientId: "id",
  clientSecret: "secret",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** A fake USCIS: token endpoint + a queue of case-status responses. */
function fakeUscis(caseResponses: (Response | Error)[], tokenResponses: Response[] = []) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/oauth/accesstoken")) return tokenResponses.shift() ?? json(200, tokenBody);
    const next = caseResponses.shift();
    if (!next) throw new Error("unexpected case-status call");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const tokenCalls = () => calls.filter((c) => c.url.endsWith("/oauth/accesstoken")).length;
  const caseCalls = () => calls.filter((c) => c.url.includes("/case-status/"));
  return { fetchImpl, calls, tokenCalls, caseCalls };
}

beforeEach(() => clearUscisTokenCache());
afterEach(() => vi.useRealTimers());

describe("fetchCaseStatus", () => {
  it("returns a normalized snapshot for a 200", async () => {
    const f = fakeUscis([json(200, noHistoryBody)]);
    const r = await fetchCaseStatus(config, "eac-9999103402", { fetchImpl: f.fetchImpl });
    expect(r.httpStatus).toBe(200);
    expect(r.snapshot.receiptNumber).toBe("EAC9999103402");
    expect(r.snapshot.status.en.title).toBe("Case Approval Was Affirmed");
    expect(r.snapshot.hasHistory).toBe(false);
    expect(f.caseCalls()[0].url).toBe("https://api-int.uscis.gov/case-status/EAC9999103402");
    const headers = f.caseCalls()[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers.demo_id).toBeUndefined();
  });

  it("sends client credentials as a form-encoded client_credentials grant", async () => {
    const f = fakeUscis([json(200, noHistoryBody)]);
    await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    const tokenCall = f.calls.find((c) => c.url.endsWith("/oauth/accesstoken"))!;
    const body = new URLSearchParams(String(tokenCall.init?.body));
    expect(tokenCall.init?.method).toBe("POST");
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("id");
    expect(body.get("client_secret")).toBe("secret");
  });

  it("parses history", async () => {
    const f = fakeUscis([json(200, withHistoryBody)]);
    const r = await fetchCaseStatus(config, "EAC9999103403", { fetchImpl: f.fetchImpl });
    expect(r.snapshot.hasHistory).toBe(true);
    expect(r.snapshot.history[0]).toEqual({
      date: { raw: "08-01-2023", local: "2023-08-01T00:00:00" },
      textEn: "Case Was Received",
      textEs: "Caso Fue Recibido",
    });
  });

  it("reuses the cached token across calls", async () => {
    const f = fakeUscis([json(200, noHistoryBody), json(200, noHistoryBody)]);
    await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    expect(f.tokenCalls()).toBe(1);
  });

  it("shares one token request between concurrent calls", async () => {
    const f = fakeUscis([json(200, noHistoryBody), json(200, noHistoryBody), json(200, noHistoryBody)]);
    await Promise.all([1, 2, 3].map(() => fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl })));
    expect(f.tokenCalls()).toBe(1);
  });

  it("fetches a new token after the cached one expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const f = fakeUscis([json(200, noHistoryBody), json(200, noHistoryBody)]);
    await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    vi.setSystemTime(Date.now() + 1799_000); // past expiry minus the 60s skew
    await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    expect(f.tokenCalls()).toBe(2);
  });

  it("refreshes the token once on 401, then succeeds", async () => {
    const f = fakeUscis([json(401, {}), json(200, noHistoryBody)]);
    const r = await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl });
    expect(r.httpStatus).toBe(200);
    expect(f.tokenCalls()).toBe(2);
  });

  it("gives up after a second 401", async () => {
    const f = fakeUscis([json(401, {}), json(401, {})]);
    await expect(fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl })).rejects.toMatchObject({
      kind: "auth",
      httpStatus: 401,
    });
  });

  it("classifies a 400 with USCIS error codes and does not retry it", async () => {
    const f = fakeUscis([json(400, errorBody)]);
    const err = await fetchCaseStatus(config, "INVALID", { fetchImpl: f.fetchImpl, skipValidation: true }).catch((e) => e);
    expect(err).toBeInstanceOf(UscisError);
    expect(err.kind).toBe("bad_request");
    expect(err.httpStatus).toBe(400);
    expect(err.details).toEqual([{ code: "INVALID_RECEIPT", message: "Receipt number is invalid", category: undefined }]);
    expect(f.caseCalls()).toHaveLength(1);
  });

  it("classifies 404 and 429 (with Retry-After) without retrying", async () => {
    const f404 = fakeUscis([json(404, {})]);
    await expect(fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f404.fetchImpl })).rejects.toMatchObject({ kind: "not_found" });
    const f429 = fakeUscis([json(429, {}, { "retry-after": "30" })]);
    await expect(fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f429.fetchImpl })).rejects.toMatchObject({
      kind: "rate_limited",
      retryAfterSeconds: 30,
    });
    expect(f429.caseCalls()).toHaveLength(1);
  });

  it("retries 5xx and network errors with backoff, then succeeds", async () => {
    const f = fakeUscis([json(503, {}), new TypeError("fetch failed"), json(200, noHistoryBody)]);
    const r = await fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl, backoffMs: 1 });
    expect(r.attempts).toBe(3);
  });

  it("stops retrying after maxRetries", async () => {
    const f = fakeUscis([json(500, {}), json(502, {})]);
    await expect(
      fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl, backoffMs: 1, maxRetries: 1 }),
    ).rejects.toMatchObject({ kind: "server", httpStatus: 502 });
  });

  it("maps timeouts", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const f = fakeUscis([timeout]);
    await expect(
      fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl, maxRetries: 0 }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("rejects a malformed receipt before calling USCIS", async () => {
    const f = fakeUscis([]);
    await expect(fetchCaseStatus(config, "ABC123", { fetchImpl: f.fetchImpl })).rejects.toMatchObject({ kind: "invalid_receipt" });
    expect(f.calls).toHaveLength(0);
  });

  it("treats a 200 without case_status as a bad response", async () => {
    const f = fakeUscis([json(200, { message: "ok" })]);
    await expect(fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl })).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("maps OAuth failures to auth errors", async () => {
    const f = fakeUscis([], [json(401, { errors: [{ code: "invalid_client" }] })]);
    await expect(fetchCaseStatus(config, "EAC9999103402", { fetchImpl: f.fetchImpl })).rejects.toMatchObject({
      kind: "auth",
      httpStatus: 401,
    });
  });

  it("sends the demo_id header when configured", async () => {
    const f = fakeUscis([json(200, noHistoryBody)]);
    await fetchCaseStatus({ ...config, demoId: "1234" }, "EAC9999103402", { fetchImpl: f.fetchImpl });
    expect((f.caseCalls()[0].init?.headers as Record<string, string>).demo_id).toBe("1234");
  });

  it("never puts credentials or tokens in error messages", async () => {
    const f = fakeUscis([json(400, errorBody)]);
    const err: UscisError = await fetchCaseStatus(config, "INVALID", { fetchImpl: f.fetchImpl, skipValidation: true }).catch((e) => e);
    const text = JSON.stringify({ m: err.message, d: err.details });
    expect(text).not.toContain("secret");
    expect(text).not.toContain("tok-1");
  });
});
