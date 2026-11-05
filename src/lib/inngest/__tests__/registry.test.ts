import { describe, expect, it } from "vitest";
import { ALL_FUNCTIONS, functionsFor, isScheduled } from "../registry";

describe("Inngest registry", () => {
  const ids = (fns: typeof ALL_FUNCTIONS) => fns.map((f) => f.opts.id).sort();
  it("knows which functions are scheduled", () => {
    expect(ALL_FUNCTIONS.filter(isScheduled).map((f) => f.opts.id).sort()).toEqual(["billing-reconcile", "schedule-case-checks"]);
  });
  it("serves everything on production and locally", () => {
    expect(functionsFor({ VERCEL_ENV: "production" })).toHaveLength(ALL_FUNCTIONS.length);
    expect(functionsFor({})).toHaveLength(ALL_FUNCTIONS.length);
  });
  it("never runs the scheduler on a preview (or an unlabelled Vercel deployment)", () => {
    expect(ids(functionsFor({ VERCEL_ENV: "preview" }))).toEqual(["check-case", "notify-status-change"]);
    expect(ids(functionsFor({ VERCEL: "1" }))).toEqual(["check-case", "notify-status-change"]);
  });
  it("uses this project's own Inngest app id, not Scanvio's", async () => {
    const { inngest } = await import("../client");
    expect(inngest.id).toBe("casepingo");
  });
});
