/**
 * Civics test quiz logic and types, with no app imports so the root tests can
 * check it against the server's copy (src/lib/civics/index.ts).
 */

export type Bilingual = { en: string; es: string };
export type CivicsVersion = "2025" | "2008";
export type TestRules = { ask: number; pass: number; failAt: number };

export type CivicsQuestion = {
  id: string;
  n: number;
  section: string;
  q: string;
  answers: string[];
  note?: string;
  star: boolean;
  kind: "fixed" | "current" | "local";
  pick: number;
  right?: string;
  wrong?: string[];
};

export type CivicsTest = {
  version: CivicsVersion;
  title: Bilingual;
  who: Bilingual;
  format: Bilingual;
  listUrl: string;
  total: number;
  rules: { standard: TestRules; senior: TestRules };
  sections: { key: string; group: Bilingual; title: Bilingual }[];
  questions: CivicsQuestion[];
};

export type CivicsResponse = {
  defaultVersion: CivicsVersion;
  currentAsOf: string;
  practicePassShare: number;
  text: { spoken: Bilingual; senior: Bilingual; local: Bilingual; current: Bilingual; disclaimer: Bilingual };
  links: { testUpdates: string; electedOfficials: string; senators: string; representative: string; studyForTheTest: string };
  versions: CivicsTest[];
};


/** Questions a mock test can ask: never local ones (they can't be checked here); only starred ones under 65/20. */
export function mockPool(questions: CivicsQuestion[], senior: boolean): CivicsQuestion[] {
  return questions.filter((q) => q.kind !== "local" && (!senior || q.star));
}

/** A repeatable random number generator (mulberry32): the same seed gives the same quiz. */
export function seededRandom(seed: number): () => number {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The four choices for a question, in random order (none for local questions). */
export function choicesFor(q: CivicsQuestion, random: () => number = Math.random): string[] {
  return q.right && q.wrong ? shuffle([q.right, ...q.wrong], random) : [];
}

/** Has the test been decided? Officers stop at the passing score or once passing is out of reach. */
export function outcome(rules: TestRules, results: boolean[]): "pass" | "fail" | null {
  const right = results.filter(Boolean).length;
  const wrong = results.length - right;
  if (right >= rules.pass) return "pass";
  if (wrong >= rules.failAt || results.length >= rules.ask) return "fail";
  return null;
}
