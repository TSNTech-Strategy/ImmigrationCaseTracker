import { z } from "zod";

// USCIS credentials are server-only environment variables (Vercel in
// production, .env locally) — same pattern as Scanvio's AMAZON_LWA_* vars.
// They are read only here and never exposed to the browser or mobile app.

export const SANDBOX_BASE_URL = "https://api-int.uscis.gov";

const schema = z.object({
  USCIS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  USCIS_BASE_URL: z.string().url().optional(),
  USCIS_CLIENT_ID: z.string().min(1),
  USCIS_CLIENT_SECRET: z.string().min(1),
  // Four-digit id USCIS issues for the production-access demo; sent as a header.
  USCIS_DEMO_ID: z.string().regex(/^\d{4}$/).optional(),
});

export type UscisConfig = {
  env: "sandbox" | "production";
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  demoId?: string;
};

/** Any env-like map (process.env, or a plain object in tests). */
export type Env = Record<string, string | undefined>;

const blankToUndefined = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export function isUscisConfigured(env: Env = process.env): boolean {
  return Boolean(blankToUndefined(env.USCIS_CLIENT_ID) && blankToUndefined(env.USCIS_CLIENT_SECRET));
}

/**
 * Mock mode, like Scanvio's MOCK_SP_API: on when asked for, or when there are
 * no credentials — so the whole app works locally before anyone has keys.
 */
export function isMockUscis(env: Env = process.env): boolean {
  return env.MOCK_USCIS === "true" || !isUscisConfigured(env);
}

export class MockInProductionError extends Error {
  constructor() {
    super(
      "USCIS is in MOCK mode on production — users would see invented case statuses. " +
        "Set MOCK_USCIS=false and provide USCIS_CLIENT_ID / USCIS_CLIENT_SECRET, then redeploy.",
    );
    this.name = "MockInProductionError";
  }
}

/** Gated on VERCEL_ENV, not NODE_ENV (which is also "production" for a local build). */
export function assertRealUscisInProduction(env: Env = process.env): void {
  if (env.VERCEL_ENV === "production" && isMockUscis(env)) throw new MockInProductionError();
}

export function getUscisConfig(env: Env = process.env): UscisConfig {
  const parsed = schema.safeParse({
    USCIS_ENV: blankToUndefined(env.USCIS_ENV),
    USCIS_BASE_URL: blankToUndefined(env.USCIS_BASE_URL),
    USCIS_CLIENT_ID: blankToUndefined(env.USCIS_CLIENT_ID),
    USCIS_CLIENT_SECRET: blankToUndefined(env.USCIS_CLIENT_SECRET),
    USCIS_DEMO_ID: blankToUndefined(env.USCIS_DEMO_ID),
  });
  if (!parsed.success) {
    // Name the variables, never echo their values.
    const vars = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ");
    throw new Error(`USCIS configuration invalid or missing: ${vars}`);
  }
  const c = parsed.data;
  // Production endpoints come from USCIS after approval — never guessed.
  if (c.USCIS_ENV === "production" && !c.USCIS_BASE_URL) {
    throw new Error("USCIS_BASE_URL is required when USCIS_ENV=production (use the endpoint USCIS issued).");
  }
  return {
    env: c.USCIS_ENV,
    baseUrl: (c.USCIS_BASE_URL ?? SANDBOX_BASE_URL).replace(/\/+$/, ""),
    clientId: c.USCIS_CLIENT_ID,
    clientSecret: c.USCIS_CLIENT_SECRET,
    demoId: c.USCIS_DEMO_ID,
  };
}
