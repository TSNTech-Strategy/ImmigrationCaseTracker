import { describe, expect, it } from "vitest";
import { inviteLawyerMailto } from "../invite-lawyer";

describe("invite your lawyer email", () => {
  it("links to the firm plans, tagged, in the person's language, with no case details", () => {
    const en = decodeURIComponent(inviteLawyerMailto(false, "https://casepingo.com/"));
    expect(en).toMatch(/^mailto:\?subject=Could you use CasePingo/);
    expect(en).toContain("https://casepingo.com/pricing?ref=client-invite#firms");
    const es = decodeURIComponent(inviteLawyerMailto(true, "https://casepingo.com"));
    expect(es).toContain("¿Podría usar CasePingo");
    expect(es).toContain("despachos de abogados");
    // No receipt numbers or statuses: it's a generic invitation the person sends themselves.
    for (const text of [en, es]) expect(text).not.toMatch(/[A-Z]{3}\d{10}/);
  });
});
