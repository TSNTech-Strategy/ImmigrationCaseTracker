import { describe, expect, it } from "vitest";
import { choicesFor, CIVICS_LINKS, CIVICS_VERSIONS, civicsTest, CURRENT, mockPool, outcome, RULES, shuffle } from "../civics";
import type { CivicsQuestion } from "../civics";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numbers = (qs: CivicsQuestion[], pred: (q: CivicsQuestion) => boolean) => qs.filter(pred).map((q) => q.n);
/** Compare answers loosely: case, parentheses, punctuation and a leading "the" don't matter. */
const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/[()[\]".,'’]/g, " ")} `
    .replace(/ (the|a|an|to|with|in|of|because) /g, " ")
    .replace(/ (the|a|an|to|with|in|of|because) /g, " ")
    .replace(/\s+/g, " ")
    .trim();

// A seeded random number generator, so shuffles are repeatable in tests.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("official lists", () => {
  it("2025: 128 questions in order, in USCIS's sections", () => {
    const t = civicsTest("2025");
    expect(t.questions.map((q) => q.n)).toEqual(range(1, 128));
    const bySection = (key: string) => numbers(t.questions, (q) => q.section === key);
    expect(bySection("principles")).toEqual(range(1, 15));
    expect(bySection("system")).toEqual(range(16, 62));
    expect(bySection("rights")).toEqual(range(63, 72));
    expect(bySection("colonial")).toEqual(range(73, 89));
    expect(bySection("1800s")).toEqual(range(90, 99));
    expect(bySection("recent")).toEqual(range(100, 118));
    expect(bySection("symbols")).toEqual(range(119, 124));
    expect(bySection("holidays")).toEqual(range(125, 128));
    expect(t.sections.map((s) => s.key)).toEqual(["principles", "system", "rights", "colonial", "1800s", "recent", "symbols", "holidays"]);
  });

  it("2008: 100 questions in order, in USCIS's sections", () => {
    const t = civicsTest("2008");
    expect(t.questions.map((q) => q.n)).toEqual(range(1, 100));
    const bySection = (key: string) => numbers(t.questions, (q) => q.section === key);
    expect(bySection("principles")).toEqual(range(1, 12));
    expect(bySection("system")).toEqual(range(13, 47));
    expect(bySection("rights")).toEqual(range(48, 57));
    expect(bySection("colonial")).toEqual(range(58, 70));
    expect(bySection("1800s")).toEqual(range(71, 77));
    expect(bySection("recent")).toEqual(range(78, 87));
    expect(bySection("geography")).toEqual(range(88, 95));
    expect(bySection("symbols")).toEqual(range(96, 98));
    expect(bySection("holidays")).toEqual(range(99, 100));
  });

  it("marks USCIS's 20 starred (65/20) questions", () => {
    expect(numbers(civicsTest("2025").questions, (q) => q.star)).toEqual([2, 7, 12, 20, 30, 36, 38, 39, 44, 52, 61, 66, 74, 78, 86, 94, 113, 115, 121, 126]);
    expect(numbers(civicsTest("2008").questions, (q) => q.star)).toEqual([6, 11, 13, 17, 20, 27, 28, 44, 45, 49, 54, 56, 70, 75, 78, 85, 94, 95, 97, 99]);
  });

  it("knows which answers depend on where you live and which on who holds office", () => {
    expect(numbers(civicsTest("2025").questions, (q) => q.kind === "local")).toEqual([23, 29, 61, 62]);
    expect(numbers(civicsTest("2008").questions, (q) => q.kind === "local")).toEqual([20, 23, 43, 44]);
    expect(numbers(civicsTest("2025").questions, (q) => q.kind === "current")).toEqual([30, 38, 39, 57]);
    expect(numbers(civicsTest("2008").questions, (q) => q.kind === "current")).toEqual([28, 29, 39, 40, 46, 47]);
    const president = civicsTest("2025").questions.find((q) => q.n === 38)!;
    expect(president.answers).toEqual([CURRENT.president.answer]);
    expect(president.note).toContain("uscis.gov/citizenship/testupdates");
  });

  it("every question is a real question with official answers", () => {
    for (const v of CIVICS_VERSIONS) {
      for (const q of civicsTest(v).questions) {
        expect(q.q, q.id).toMatch(/[?.]$/);
        expect(q.answers.length, q.id).toBeGreaterThan(0);
        expect(new Set(q.answers).size, `${q.id} repeats an answer`).toBe(q.answers.length);
        if (q.pick > 1) expect(q.answers.length, q.id).toBeGreaterThan(q.pick);
      }
    }
  });
});

describe("practice choices", () => {
  it("every question that can be multiple choice has one right and three different wrong choices", () => {
    for (const v of CIVICS_VERSIONS) {
      for (const q of civicsTest(v).questions) {
        if (q.kind === "local") {
          expect(q.right, q.id).toBeUndefined();
          continue;
        }
        expect(q.right, q.id).toBeTruthy();
        expect(q.wrong, q.id).toHaveLength(3);
        const all = [q.right!, ...q.wrong!].map(norm);
        expect(new Set(all).size, `${q.id} has duplicate choices`).toBe(4);
      }
    }
  });

  it("a wrong choice is never an accepted answer", () => {
    for (const v of CIVICS_VERSIONS) {
      for (const q of civicsTest(v).questions) {
        if (!q.wrong) continue;
        const accepted = q.answers.map(norm);
        for (const w of q.wrong) expect(accepted, `${q.id}: "${w}"`).not.toContain(norm(w));
      }
    }
  });

  it("the right choice is one of the official answers (or, for 'name two', made of them)", () => {
    const off: string[] = [];
    for (const v of CIVICS_VERSIONS) {
      for (const q of civicsTest(v).questions) {
        if (!q.right) continue;
        const right = norm(q.right);
        const accepted = q.answers.map(norm);
        const ok =
          q.pick > 1 ? accepted.filter((a) => right.includes(a)).length >= q.pick : accepted.some((a) => right.includes(a) || a.includes(right));
        if (!ok) off.push(`${q.id}: "${q.right}"`);
      }
    }
    expect(off).toEqual([]);
  });

  it("current officials' wrong choices never include the current answer", () => {
    const { asOf, ...offices } = CURRENT;
    expect(asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const [office, { answer, wrong }] of Object.entries(offices)) {
      expect(wrong.map(norm), office).not.toContain(norm(answer));
    }
  });

  it("shuffles the four choices", () => {
    const q = civicsTest("2025").questions[0];
    const choices = choicesFor(q, seeded(7));
    expect([...choices].sort()).toEqual([q.right!, ...q.wrong!].sort());
    expect(choicesFor(civicsTest("2025").questions.find((x) => x.kind === "local")!)).toEqual([]);
    expect(shuffle([1, 2, 3, 4, 5], seeded(1))).not.toEqual([1, 2, 3, 4, 5]);
  });
});

describe("official pass and fail rules", () => {
  it("every test is decided by its last question", () => {
    for (const v of CIVICS_VERSIONS) {
      for (const r of [RULES[v].standard, RULES[v].senior]) expect(r.pass + r.failAt - 1).toBe(r.ask);
    }
    expect(RULES["2025"].standard).toEqual({ ask: 20, pass: 12, failAt: 9 });
    expect(RULES["2008"].standard).toEqual({ ask: 10, pass: 6, failAt: 5 });
    expect(RULES["2025"].senior).toEqual({ ask: 10, pass: 6, failAt: 5 });
  });

  it("stops at 12 right (pass) or 9 wrong (fail) on the 2025 test", () => {
    const r = RULES["2025"].standard;
    expect(outcome(r, [])).toBeNull();
    expect(outcome(r, Array(11).fill(true))).toBeNull();
    expect(outcome(r, Array(12).fill(true))).toBe("pass");
    expect(outcome(r, [...Array(8).fill(false), ...Array(11).fill(true)])).toBeNull();
    expect(outcome(r, [...Array(8).fill(false), ...Array(12).fill(true)])).toBe("pass");
    expect(outcome(r, Array(9).fill(false))).toBe("fail");
    expect(outcome(r, [...Array(11).fill(true), ...Array(9).fill(false)])).toBe("fail");
  });

  it("stops at 6 right or 5 wrong on the 2008 test", () => {
    const r = RULES["2008"].standard;
    expect(outcome(r, [true, true, true, true, true, true])).toBe("pass");
    expect(outcome(r, [false, true, false, true, false, true, false, true, false])).toBe("fail");
    expect(outcome(r, [false, true, false, true, false, true, false, true, true])).toBeNull();
  });

  it("mock tests never ask questions that depend on where you live; 65/20 asks only starred ones", () => {
    const t = civicsTest("2025");
    expect(mockPool(t.questions, false)).toHaveLength(124);
    const senior = mockPool(t.questions, true);
    expect(senior.every((q) => q.star && q.kind !== "local")).toBe(true);
    expect(senior).toHaveLength(19);
    expect(mockPool(civicsTest("2008").questions, true)).toHaveLength(18);
    expect(senior.length).toBeGreaterThanOrEqual(RULES["2025"].senior.ask);
  });
});

describe("links", () => {
  it("point to official government sites over https", () => {
    for (const url of Object.values(CIVICS_LINKS)) expect(url).toMatch(/^https:\/\/www\.(uscis|usa|senate|house)\.gov\//);
    for (const v of CIVICS_VERSIONS) expect(civicsTest(v).listUrl).toMatch(/^https:\/\/www\.uscis\.gov\/.+\.pdf$/);
  });
});

describe("the app's copy of the quiz logic", () => {
  it("agrees with the server's", async () => {
    const app = await import("../../../mobile/src/lib/civics-quiz");
    for (const v of CIVICS_VERSIONS) {
      const t = civicsTest(v);
      for (const senior of [false, true]) {
        expect(app.mockPool(t.questions, senior).map((q) => q.id)).toEqual(mockPool(t.questions, senior).map((q) => q.id));
        const rules = senior ? t.rules.senior : t.rules.standard;
        const random = seeded(v === "2025" ? 3 : 4);
        for (let run = 0; run < 200; run++) {
          const results = Array.from({ length: rules.ask }, () => random() < 0.6);
          for (let i = 0; i <= results.length; i++) expect(app.outcome(rules, results.slice(0, i))).toBe(outcome(rules, results.slice(0, i)));
        }
      }
    }
    expect(app.shuffle([1, 2, 3, 4, 5, 6], seeded(9))).toEqual(shuffle([1, 2, 3, 4, 5, 6], seeded(9)));
    const q = civicsTest("2008").questions[5];
    expect(app.choicesFor(q, seeded(2))).toEqual(choicesFor(q, seeded(2)));
    const r = app.seededRandom(0.42);
    const again = app.seededRandom(0.42);
    expect([r(), r(), r()]).toEqual([again(), again(), again()]);
  });
});
