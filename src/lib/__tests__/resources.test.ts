import { describe, expect, it } from "vitest";
import { contactEmail, RESOURCES, resourceBySlug, resourcePath, type Text } from "../resources";
import { STATUS_GUIDE } from "../status-guide";

const texts = (): Text[] =>
  RESOURCES.flatMap((r) => [
    r.title,
    r.summary,
    r.intro,
    ...r.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]),
    ...(r.faq ?? []).flatMap((f) => [f.q, f.a]),
    ...r.links.map((l) => l.label),
  ]);

describe("resource center", () => {
  it("has the guides the hub shows, each findable by its slug", () => {
    expect(RESOURCES.map((r) => r.slug)).toEqual(["processing-times", "interviews", "news", "faq", "how-casepingo-helps", "contact"]);
    for (const r of RESOURCES) expect(resourceBySlug(r.slug)).toBe(r);
    expect(resourcePath("faq")).toBe("/resources/faq");
    expect(resourceBySlug("nope")).toBeNull();
  });

  it("has every text in English and Spanish", () => {
    for (const t of texts()) {
      expect(t.en.trim().length, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t.es.trim().length, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t.es).not.toBe(t.en.length > 12 ? t.en : "__different__");
    }
  });

  it("links only to official https pages or to pages of this site that exist", () => {
    const internal = new Set(["/status-guide", "/visa-bulletin", "/civics-test", "/how-it-works", "/pricing", ...RESOURCES.map((r) => resourcePath(r.slug))]);
    const links = RESOURCES.flatMap((r) => [...r.links, ...(r.faq ?? []).flatMap((f) => f.links ?? [])]);
    for (const l of links) {
      if (l.url.startsWith("/")) expect(internal.has(l.url), l.url).toBe(true);
      else expect(l.url, l.url).toMatch(/^https:\/\/([a-z]+\.)?uscis\.gov\//);
    }
    expect(STATUS_GUIDE.length).toBeGreaterThan(0);
  });

  it("shows the support email only when a real address is set", () => {
    expect(contactEmail({})).toBeNull();
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: "[contact email — to be added]" })).toBeNull();
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: " help@casepingo.com " })).toBe("help@casepingo.com");
  });
});
