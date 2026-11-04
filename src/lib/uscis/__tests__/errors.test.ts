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
  it("reads errors as a single object", () => {
    expect(parseErrorDetails({ errors: { code: "A", message: "b" } })).toEqual([{ code: "A", message: "b", category: undefined }]);
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
