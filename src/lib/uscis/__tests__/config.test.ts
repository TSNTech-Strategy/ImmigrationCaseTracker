import { describe, expect, it } from "vitest";
import { assertRealUscisInProduction, getUscisConfig, isMockUscis, MockInProductionError } from "../config";

const creds = { USCIS_CLIENT_ID: "id", USCIS_CLIENT_SECRET: "secret" };

describe("USCIS config", () => {
  it("defaults to the sandbox", () => {
    expect(getUscisConfig({ ...creds })).toMatchObject({ env: "sandbox", baseUrl: "https://api-int.uscis.gov" });
  });

  it("requires an explicit base URL for production", () => {
    expect(() => getUscisConfig({ ...creds, USCIS_ENV: "production" })).toThrow(/USCIS_BASE_URL/);
  });

  it("names missing variables without echoing values", () => {
    expect(() => getUscisConfig({ USCIS_CLIENT_ID: "visible-id" })).toThrow(/USCIS_CLIENT_SECRET/);
    try {
      getUscisConfig({ USCIS_CLIENT_ID: "visible-id" });
    } catch (e) {
      expect((e as Error).message).not.toContain("visible-id");
    }
  });

  it("is in mock mode without credentials or when asked", () => {
    expect(isMockUscis({})).toBe(true);
    expect(isMockUscis({ ...creds, MOCK_USCIS: "true" })).toBe(true);
    expect(isMockUscis({ ...creds })).toBe(false);
  });

  it("refuses mock mode on the production deployment", () => {
    expect(() => assertRealUscisInProduction({ VERCEL_ENV: "production" })).toThrow(MockInProductionError);
    expect(() => assertRealUscisInProduction({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertRealUscisInProduction({ VERCEL_ENV: "production", ...creds })).not.toThrow();
  });
});
