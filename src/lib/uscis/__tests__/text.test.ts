import { describe, expect, it } from "vitest";
import { isAllowedLink, parseUscisText, redactReceiptInText, redactSnapshot } from "../text";
import { normalizeCaseStatus } from "../normalize";

const real =
  'The approval of your case, Receipt Number EAC9999103402, was affirmed. If you move, go to <a href="https://www.uscis.gov/addresschange" target="_blank">www.uscis.gov/addresschange</a> to give us your new mailing address.';

describe("receipt redaction", () => {
  it("masks the receipt number wherever it appears", () => {
    expect(redactReceiptInText(real, "EAC9999103402")).toContain("Receipt Number EAC*******402,");
    expect(redactReceiptInText(real, "eac9999103402")).not.toContain("9999103402");
    expect(redactReceiptInText(null, "EAC9999103402")).toBeNull();
  });
  it("redacts every text field of a snapshot", () => {
    const s = normalizeCaseStatus(
      {
        case_status: {
          receiptNumber: "EAC9999103402",
          current_case_status_text_en: "Case EAC9999103402 Approved",
          current_case_status_desc_en: real,
          current_case_status_desc_es: "Recibo EAC9999103402",
          hist_case_status: [{ date: "01-01-2023", completed_text_en: "Received EAC9999103402" }],
        },
      },
      "EAC9999103402",
    );
    const r = redactSnapshot(s, "EAC9999103402");
    expect(JSON.stringify({ ...r, fingerprint: "" })).not.toContain("9999103402");
    expect(r.fingerprint).toBe(s.fingerprint); // change detection unaffected
  });
});

describe("parseUscisText", () => {
  it("turns USCIS .gov links into link segments and keeps the text", () => {
    expect(parseUscisText(real)).toEqual([
      { type: "text", text: "The approval of your case, Receipt Number EAC9999103402, was affirmed. If you move, go to " },
      { type: "link", text: "www.uscis.gov/addresschange", href: "https://www.uscis.gov/addresschange" },
      { type: "text", text: " to give us your new mailing address." },
    ]);
  });
  it("never links to non-.gov or non-https targets", () => {
    for (const href of ["http://www.uscis.gov/x", "https://evil.com/uscis.gov", "javascript:alert(1)", "https://uscis.gov.evil.com/"]) {
      const segs = parseUscisText(`a <a href="${href}">click</a> b`);
      expect(segs).toEqual([{ type: "text", text: "a click b" }]);
    }
  });
  it("drops other tags and decodes entities, producing no HTML", () => {
    expect(parseUscisText("<b>Bold</b> &amp; <script>x</script> &lt;ok&gt;")).toEqual([{ type: "text", text: "Bold & x <ok>" }]);
  });
  it("allow-list rules", () => {
    expect(isAllowedLink("https://www.uscis.gov/a")).toBe(true);
    expect(isAllowedLink("https://egov.uscis.gov/")).toBe(true);
    expect(isAllowedLink("https://www.state.gov/")).toBe(true);
    expect(isAllowedLink("https://uscis.gov.example.com/")).toBe(false);
    expect(isAllowedLink("not a url")).toBe(false);
  });
});
