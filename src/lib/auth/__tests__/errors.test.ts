import { describe, expect, it } from "vitest";
import { authErrorMessage } from "../errors";

describe("authErrorMessage", () => {
  it("maps known Supabase codes", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("Email or password is incorrect.");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirm your email/);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/Too many attempts/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });
  it("never leaks raw server messages", () => {
    expect(authErrorMessage({ code: "unexpected_failure", message: "db timeout at 10.0.0.3" })).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
