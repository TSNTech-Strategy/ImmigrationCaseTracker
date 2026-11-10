import { describe, expect, it } from "vitest";
import { inspect } from "node:util";
import { parseErrorDetails, readBody, UscisError, kindForStatus } from "../errors";

describe("parseErrorDetails", () => {
  it("reads the documented errors[] shape", () => {
    expect(parseErrorDetails({ errors: [{ code: "X1", message: "bad" }] })).toEqual([
      { code: "X1", message: "bad", category: undefined },
    ]);
  });
  it("reads OAuth-style error / error_description", () => {
    expect(parseErrorDetails({ error: "invalid_client", error_description: "Client authentication failed" })).toEqual([
      { code: "invalid_client", message: "Client authentication failed", category: undefined },
    ]);
  });
  it("reads Apigee fault bodies", () => {
    expect(
      parseErrorDetails({ fault: { faultstring: "Invalid Access Token", detail: { errorcode: "keymanagement.service.invalid_access_token" } } }),
    ).toEqual([{ code: "keymanagement.service.invalid_access_token", message: "Invalid Access Token", category: undefined }]);
  });
  it("reads RFC 7807 and bare code/message bodies", () => {
    expect(parseErrorDetails({ title: "Unprocessable", detail: "receipt invalid", type: "validation" })).toEqual([
      { code: undefined, message: "receipt invalid", category: "validation" },
    ]);
    expect(parseErrorDetails({ code: 422, message: "nope" })).toEqual([{ code: "422", message: "nope", category: undefined }]);
  });
  it("reads the real sandbox 422 body (a bare message)", () => {
    const body = {
      message:
        "The application receipt number is not formatted correctly, It should be a total of 13 characters (3 character prefix followed by 10 digits). Please check your receipt number and try again.",
    };
    const [d] = parseErrorDetails(body);
    expect(d.code).toBeUndefined();
    expect(d.message).toMatch(/^The application receipt number is not formatted correctly/);
  });
  it("reads errors as a single object", () => {
    expect(parseErrorDetails({ errors: { code: "A", message: "b" } })).toEqual([{ code: "A", message: "b", category: undefined }]);
  });
  it("reads the sandbox's { error: { code, message } } body (503 outside opening hours)", () => {
    const body = { error: { code: "503", message: "The Case Status API Sandbox is unavailable at this time." } };
    expect(parseErrorDetails(body)).toEqual([{ code: "503", message: "The Case Status API Sandbox is unavailable at this time." }]);
  });
  it("reads the sandbox OAuth body with capitalized keys", () => {
    expect(parseErrorDetails({ ErrorCode: "invalid_client", Error: "Client credentials are invalid", token_type: "Bearer" })).toEqual([
      { code: "invalid_client", message: "Client credentials are invalid" },
    ]);
  });
  it("keeps the RFC 9457 reference and traceId USCIS documents", () => {
    const body = { code: "E404", message: "not found", category: "client", reference: "ref-1", status: 404, traceId: "abc123" };
    expect(parseErrorDetails(body)).toEqual([{ code: "E404", message: "not found", category: "client", reference: "ref-1", traceId: "abc123" }]);
  });
  it("exposes USCIS's message on the error", () => {
    const e = new UscisError("not_found", "HTTP 404", { httpStatus: 404, details: [{ code: "404" }, { message: "Case Status Online does not recognize…" }] });
    expect(e.uscisMessage).toBe("Case Status Online does not recognize…");
    expect(new UscisError("network", "down").uscisMessage).toBeUndefined();
  });
  it("returns nothing for empty or non-object bodies", () => {
    expect(parseErrorDetails(null)).toEqual([]);
    expect(parseErrorDetails("Bad gateway")).toEqual([]);
    expect(parseErrorDetails({})).toEqual([]);
    expect(parseErrorDetails({ errors: [{}] })).toEqual([]);
  });
  it("truncates long values", () => {
    expect(parseErrorDetails({ errors: [{ message: "x".repeat(1000) }] })[0].message).toHaveLength(300);
  });
});

describe("UscisError.responseBody", () => {
  it("is available but never serialized or inspected", () => {
    const e = new UscisError("bad_request", "HTTP 422", { httpStatus: 422, responseBody: { echoed: "EAC9999103402" } });
    expect(e.responseBody).toEqual({ echoed: "EAC9999103402" });
    expect(JSON.stringify(e)).not.toContain("EAC9999103402");
    expect(inspect(e)).not.toContain("EAC9999103402");
    expect(Object.keys(e)).not.toContain("responseBody");
  });
});

describe("readBody", () => {
  it("parses JSON, falls back to text, and handles empty bodies", async () => {
    expect(await readBody(new Response('{"a":1}'))).toEqual({ a: 1 });
    expect(await readBody(new Response("<html>Bad Gateway</html>"))).toBe("<html>Bad Gateway</html>");
    expect(await readBody(new Response(""))).toBeNull();
  });
});

describe("kindForStatus", () => {
  it("treats 422 (what the sandbox returns for a malformed receipt) as bad_request", () => {
    expect(kindForStatus(422)).toBe("bad_request");
  });
});
