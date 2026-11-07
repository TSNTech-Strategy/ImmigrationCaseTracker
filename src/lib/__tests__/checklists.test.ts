import { describe, expect, it } from "vitest";
import { CHECKLISTS, COMMON_TIPS, checklistByKey, checklistForForm, checklistItems, checklistProgress, checklistSummaries } from "../checklists";

const filled = (b: { en: string; es: string } | undefined) => !b || (b.en.trim().length > 0 && b.es.trim().length > 0 && b.en !== b.es);

describe("document checklists", () => {
  it("cover the common case types, each with English and Spanish text", () => {
    expect(CHECKLISTS.map((c) => c.form)).toEqual(["I-485", "I-130", "I-765", "I-131", "I-90", "I-751", "N-400", "I-129F", "I-539", "I-821D", "I-821", "I-589"]);
    for (const c of CHECKLISTS) {
      expect(filled(c.title) && filled(c.summary), c.key).toBe(true);
      expect(c.groups.length, c.key).toBeGreaterThan(0);
      for (const g of c.groups) {
        expect(filled(g.title), `${c.key}/${g.key}`).toBe(true);
        expect(g.items.length, `${c.key}/${g.key}`).toBeGreaterThan(0);
        for (const i of g.items) expect(filled(i.title) && filled(i.detail), `${c.key}/${i.key}`).toBe(true);
      }
      for (const t of c.tips) expect(filled(t), c.key).toBe(true);
    }
    for (const t of COMMON_TIPS) expect(filled(t)).toBe(true);
  });

  it("use unique item keys within a checklist, start with the signed form, and have required items", () => {
    for (const c of CHECKLISTS) {
      const keys = checklistItems(c).map((i) => i.key);
      expect(new Set(keys).size, c.key).toBe(keys.length);
      expect(checklistItems(c)[0].title.en, c.key).toMatch(new RegExp(`^Form ${c.form}`));
      expect(checklistItems(c).filter((i) => i.required).length, c.key).toBeGreaterThan(1);
    }
  });

  it("link to the official form page and only to official or CasePingo pages", () => {
    for (const c of CHECKLISTS) {
      expect(c.links[0].url, c.key).toBe(`https://www.uscis.gov/${c.form.toLowerCase()}`);
      for (const l of c.links) expect(l.url, c.key).toMatch(/^(https:\/\/www\.uscis\.gov\/|\/)/);
    }
  });

  it("find the checklist for a case's form, however USCIS writes it", () => {
    expect(checklistForForm("I-485")?.key).toBe("i-485");
    expect(checklistForForm("i485")?.key).toBe("i-485");
    expect(checklistForForm("N400")?.key).toBe("n-400");
    expect(checklistForForm("I-129F")?.key).toBe("i-129f");
    expect(checklistForForm("I-140")).toBeNull();
    expect(checklistForForm(null)).toBeNull();
    expect(checklistByKey("nope")).toBeNull();
  });

  it("count progress: required items and everything ticked", () => {
    const c = checklistByKey("i-765")!;
    const p = checklistProgress(c, ["form", "photos", "fee-waiver", "unknown"]);
    expect(p).toEqual({ required: checklistItems(c).filter((i) => i.required).length, requiredDone: 2, done: 3, total: checklistItems(c).length });
    expect(checklistSummaries().find((s) => s.key === "i-765")).toMatchObject({ form: "I-765", total: p.total, required: p.required });
  });
});
