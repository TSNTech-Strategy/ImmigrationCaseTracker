import { beforeAll, describe, expect, it } from "vitest";
import { portalPath, portalToken, readPortalToken } from "../firms/portal";

describe("client status page links", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });

  it("names the client and version, and can't be edited or guessed", () => {
    const token = portalToken("cmclient0001abcd", 3);
    expect(readPortalToken(token)).toEqual({ clientId: "cmclient0001abcd", version: 3 });
    expect(portalPath("cmclient0001abcd", 3)).toBe(`/status/${token}`);
    // Another version or client needs another signature.
    const [, mac] = token.split(".");
    const forged = `${Buffer.from("cmclient0002abcd.3").toString("base64url")}.${mac}`;
    expect(readPortalToken(forged)).toBeNull();
    expect(readPortalToken(`${token}x`)).toBeNull();
    expect(readPortalToken("nonsense")).toBeNull();
    expect(readPortalToken(`${token}.extra`)).toBeNull();
    expect(readPortalToken(`${Buffer.from("x".repeat(300)).toString("base64url")}.${mac}`)).toBeNull();
  });
});
