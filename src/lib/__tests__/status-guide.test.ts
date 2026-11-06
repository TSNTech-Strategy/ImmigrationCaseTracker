import { describe, expect, it } from "vitest";
import { STATUS_GUIDE, findStatusGuide, guideCategory, guideText, statusGuideBySlug } from "../status-guide";

describe("status guide", () => {
  it("has unique slugs and complete text in both languages", () => {
    const slugs = new Set<string>();
    for (const g of STATUS_GUIDE) {
      expect(slugs.has(g.slug), g.slug).toBe(false);
      slugs.add(g.slug);
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      for (const t of [g.meaning, g.next, ...(g.todo ? [g.todo] : [])]) {
        expect(t.en.trim().length, g.slug).toBeGreaterThan(10);
        expect(t.es.trim().length, g.slug).toBeGreaterThan(10);
      }
    }
    expect(STATUS_GUIDE.length).toBeGreaterThanOrEqual(30);
  });

  it("finds every entry by its own title and aliases", () => {
    for (const g of STATUS_GUIDE) {
      expect(findStatusGuide(g.title)?.slug, g.title).toBe(g.slug);
      for (const a of g.aliases ?? []) expect(findStatusGuide(a)?.slug, a).toBe(g.slug);
      expect(statusGuideBySlug(g.slug)).toBe(g);
    }
  });

  it("tolerates case, spacing and apostrophe differences", () => {
    expect(findStatusGuide("  case was APPROVED ")?.slug).toBe("case-was-approved");
    expect(findStatusGuide("Response To USCIS’ Request For Evidence Was Received")?.slug).toBe("response-to-request-for-evidence-was-received");
    expect(findStatusGuide("Case Was Rejected Because The Version Of The Form I Sent Is No Longer Accepted")?.slug).toBe("case-was-rejected");
    expect(findStatusGuide("Request For Evidence Was Mailed")?.slug).toBe("request-for-evidence-was-sent");
  });

  it("returns nothing for unknown or empty titles", () => {
    expect(findStatusGuide("Something Entirely New")).toBeNull();
    expect(findStatusGuide("")).toBeNull();
    expect(findStatusGuide(null)).toBeNull();
  });

  it("keeps the colour category consistent with what the entry says", () => {
    const cat = (slug: string) => guideCategory(statusGuideBySlug(slug)!);
    expect(cat("case-was-received")).toBe("progress");
    expect(cat("request-for-evidence-was-sent")).toBe("action");
    expect(cat("request-for-initial-evidence-was-sent")).toBe("action");
    expect(cat("response-to-request-for-evidence-was-received")).toBe("progress");
    expect(cat("expedite-request-denied")).toBe("progress");
    expect(cat("case-was-approved")).toBe("done");
    expect(cat("oath-ceremony-was-scheduled")).toBe("done");
    expect(cat("card-was-delivered")).toBe("done");
    expect(cat("case-was-denied")).toBe("stop");
    expect(cat("case-was-rejected")).toBe("stop");
    expect(cat("withdrawal-acknowledgement-notice-was-sent")).toBe("stop");
    expect(cat("mail-was-returned-to-uscis")).toBe("stop");
    for (const g of STATUS_GUIDE) expect(guideCategory(g), g.slug).not.toBe("none");
  });

  it("gives the text in one language", () => {
    const g = statusGuideBySlug("case-was-approved")!;
    expect(guideText(g, "es").meaning).toBe("USCIS aprobó su solicitud o petición.");
    expect(guideText(statusGuideBySlug("fees-were-waived")!, "en").todo).toBeNull();
  });
});
