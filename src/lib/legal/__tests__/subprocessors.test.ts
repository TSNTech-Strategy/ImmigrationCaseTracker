import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/features";
import { subprocessors } from "../subprocessors";

describe("subprocessors list", () => {
  it("names every outside service that receives customer data", () => {
    const names = subprocessors().filter((s) => s.active).map((s) => s.name);
    for (const n of ["Vercel", "Supabase", "Inngest", "Resend", "Stripe", "Cloudmersive", "Expo"]) expect(names).toContain(n);
  });
  it("lists the AI provider as active only when the assistant is on", () => {
    expect(subprocessors().find((s) => s.name === "Anthropic")!.active).toBe(FEATURES.assistant);
  });
  it("has a purpose, data, US location and privacy link for each", () => {
    for (const s of subprocessors()) {
      expect(s.purpose && s.data && s.entity).toBeTruthy();
      expect(s.location).toMatch(/United States/);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
});
