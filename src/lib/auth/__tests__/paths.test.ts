import { describe, expect, it } from "vitest";
import { bearerToken, isAuthPage, isProtectedPath, safeNextPath } from "../paths";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/cases/abc?tab=history#top")).toBe("/cases/abc?tab=history#top");
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "\\\\evil.com", "evil.com", "javascript:alert(1)", "", null, 42])(
    "rejects %s",
    (v) => {
      expect(safeNextPath(v)).toBe("/cases");
    },
  );
  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/reset-password")).toBe("/reset-password");
  });
});

describe("route classification", () => {
  it("protects app areas", () => {
    for (const p of ["/cases", "/cases/1", "/bulletin", "/civics", "/settings", "/firm/team", "/admin", "/reset-password"]) {
      expect(isProtectedPath(p)).toBe(true);
    }
    for (const p of ["/", "/login", "/casesx", "/privacy", "/auth/confirm", "/visa-bulletin", "/bulletins", "/civics-test"]) expect(isProtectedPath(p)).toBe(false);
  });
  it("recognises sign-in pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/reset-password")).toBe(false);
    expect(isAuthPage("/login/mfa")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer abc")).toBe("abc");
  });
  it("rejects anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});
