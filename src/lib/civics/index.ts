/**
 * Practice for the naturalization civics test, with USCIS's official questions.
 *
 * Two official lists are in use: the 2025 test (128 questions) for people who
 * filed Form N-400 on or after October 20, 2025, and the 2008 test (100
 * questions) for people who filed before. Questions keep USCIS's numbers,
 * sections and wording; answers to "who is ... now?" questions come from
 * CURRENT below, which must follow USCIS's test updates page.
 *
 * Shown on the website (/civics-test, /civics) and sent to the app by
 * GET /api/v1/civics, so a correction doesn't need an app release.
 */

import { QUESTIONS_2008, SECTIONS_2008 } from "./test-2008";
import { QUESTIONS_2025, SECTIONS_2025 } from "./test-2025";
import type { CivicsQuestion, CivicsSection, CivicsVersion, CurrentKey, RawQuestion, TestRules, Text } from "./types";

export type { CivicsQuestion, CivicsSection, CivicsVersion, TestRules, Text } from "./types";

/**
 * Who holds office now, for the "now" questions. Update when USCIS updates
 * https://www.uscis.gov/citizenship/testupdates (after elections and
 * appointments), and set asOf to the day you checked. Wrong choices must never
 * be the current answer.
 */
export const CURRENT: { asOf: string } & Record<CurrentKey, { answer: string; wrong: [string, string, string] }> = {
  asOf: "2026-11-06",
  president: { answer: "Donald J. Trump", wrong: ["Joe Biden", "Barack Obama", "George W. Bush"] },
  vicePresident: { answer: "JD Vance", wrong: ["Kamala Harris", "Mike Pence", "Joe Biden"] },
  speaker: { answer: "Mike Johnson", wrong: ["Nancy Pelosi", "Kevin McCarthy", "Paul Ryan"] },
  chiefJustice: { answer: "John Roberts", wrong: ["Clarence Thomas", "Sonia Sotomayor", "Ruth Bader Ginsburg"] },
  presidentParty: { answer: "Republican (Party)", wrong: ["Democratic (Party)", "Libertarian (Party)", "Green (Party)"] },
  justices: { answer: "Nine (9)", wrong: ["Seven (7)", "Twelve (12)", "Fifteen (15)"] },
};

/** The official format. `senior` is the 65/20 exception: 10 of the 20 starred questions. */
export const RULES: Record<CivicsVersion, { standard: TestRules; senior: TestRules }> = {
  "2025": { standard: { ask: 20, pass: 12, failAt: 9 }, senior: { ask: 10, pass: 6, failAt: 5 } },
  "2008": { standard: { ask: 10, pass: 6, failAt: 5 }, senior: { ask: 10, pass: 6, failAt: 5 } },
};

/** Practice by section uses the real test's passing share: 60% (12 of 20, 6 of 10). */
export const PRACTICE_PASS_SHARE = 0.6;

export const CIVICS_LINKS = {
  list2025: "https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf",
  list2008: "https://www.uscis.gov/sites/default/files/document/questions-and-answers/100q.pdf",
  testUpdates: "https://www.uscis.gov/citizenship/testupdates",
  studyForTheTest: "https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test",
  electedOfficials: "https://www.usa.gov/elected-officials",
  senators: "https://www.senate.gov/senators/senators-contact.htm",
  representative: "https://www.house.gov/representatives/find-your-representative",
} as const;

export const DEFAULT_VERSION: CivicsVersion = "2025";

type VersionInfo = {
  version: CivicsVersion;
  title: Text;
  /** Who takes this version. */
  who: Text;
  /** How the officer gives it. */
  format: Text;
  listUrl: string;
  sections: CivicsSection[];
  raw: RawQuestion[];
};

const INFO: Record<CivicsVersion, VersionInfo> = {
  "2025": {
    version: "2025",
    title: { en: "2025 civics test", es: "Examen de cívica de 2025" },
    who: {
      en: "For applications (Form N-400) filed on or after October 20, 2025.",
      es: "Para solicitudes (Formulario N-400) presentadas a partir del 20 de octubre de 2025.",
    },
    format: {
      en: "The officer asks up to 20 of the 128 questions. You pass with 12 correct answers; the officer stops once you have 12 right or 9 wrong.",
      es: "El oficial hace hasta 20 de las 128 preguntas. Aprueba con 12 respuestas correctas; el oficial se detiene cuando tiene 12 correctas o 9 incorrectas.",
    },
    listUrl: CIVICS_LINKS.list2025,
    sections: SECTIONS_2025,
    raw: QUESTIONS_2025,
  },
  "2008": {
    version: "2008",
    title: { en: "2008 civics test", es: "Examen de cívica de 2008" },
    who: {
      en: "For applications (Form N-400) filed before October 20, 2025.",
      es: "Para solicitudes (Formulario N-400) presentadas antes del 20 de octubre de 2025.",
    },
    format: {
      en: "The officer asks up to 10 of the 100 questions. You pass with 6 correct answers; the officer stops once you have 6 right or 5 wrong.",
      es: "El oficial hace hasta 10 de las 100 preguntas. Aprueba con 6 respuestas correctas; el oficial se detiene cuando tiene 6 correctas o 5 incorrectas.",
    },
    listUrl: CIVICS_LINKS.list2008,
    sections: SECTIONS_2008,
    raw: QUESTIONS_2008,
  },
};

/** Text shared by both versions. */
export const CIVICS_TEXT = {
  spoken: {
    en: "The civics test is spoken: the officer reads each question in English and you answer out loud. USCIS encourages you to answer with the answers on its list.",
    es: "El examen de cívica es oral: el oficial lee cada pregunta en inglés y usted responde en voz alta. USCIS recomienda responder con las respuestas de su lista.",
  },
  senior: {
    en: "If you're 65 or older and have been a permanent resident for 20 years or more, you study only the 20 questions marked with a star. The officer asks 10 of them and you need 6 correct. You may also take the civics test in your own language.",
    es: "Si tiene 65 años o más y ha sido residente permanente por 20 años o más, estudia solo las 20 preguntas marcadas con una estrella. El oficial le hace 10 y necesita 6 correctas. También puede tomar el examen de cívica en su idioma.",
  },
  local: {
    en: "This answer depends on where you live. Look it up before your interview.",
    es: "Esta respuesta depende de dónde vive. Búsquela antes de su entrevista.",
  },
  current: {
    en: "This answer changes with elections and appointments. Check USCIS's test updates page before your interview.",
    es: "Esta respuesta cambia con las elecciones y los nombramientos. Revise la página de actualizaciones del examen de USCIS antes de su entrevista.",
  },
  disclaimer: {
    en: "Questions and answers from USCIS's official lists. Practice choices are written by CasePingo. Not affiliated with USCIS; not legal advice.",
    es: "Preguntas y respuestas de las listas oficiales de USCIS. Las opciones de práctica las escribe CasePingo. Sin afiliación con USCIS; no es asesoría legal.",
  },
} satisfies Record<string, Text>;

function resolve(version: CivicsVersion, raw: RawQuestion): CivicsQuestion {
  const base = { id: `${version}-${raw.n}`, n: raw.n, section: raw.s, q: raw.q, star: Boolean(raw.star), ...(raw.note ? { note: raw.note } : {}) };
  if ("current" in raw) {
    const now = CURRENT[raw.current];
    return { ...base, kind: "current", answers: [now.answer], pick: 1, right: now.answer, wrong: [...now.wrong] };
  }
  if ("local" in raw) return { ...base, kind: "local", answers: ["Answers will vary."], pick: 1 };
  return { ...base, kind: "fixed", answers: raw.a, pick: raw.pick ?? 1, right: raw.right, wrong: [...raw.wrong] };
}

export type CivicsTest = Omit<VersionInfo, "raw"> & {
  total: number;
  rules: { standard: TestRules; senior: TestRules };
  questions: CivicsQuestion[];
};

const TESTS: Record<CivicsVersion, CivicsTest> = Object.fromEntries(
  (Object.keys(INFO) as CivicsVersion[]).map((v) => {
    const { raw, ...info } = INFO[v];
    return [v, { ...info, total: raw.length, rules: RULES[v], questions: raw.map((r) => resolve(v, r)) }];
  }),
) as Record<CivicsVersion, CivicsTest>;

export function civicsTest(version: CivicsVersion): CivicsTest {
  return TESTS[version];
}

export const CIVICS_VERSIONS: CivicsVersion[] = ["2025", "2008"];

export const isCivicsVersion = (v: unknown): v is CivicsVersion => v === "2025" || v === "2008";

// ---- Quiz logic (pure; the app keeps a copy in mobile/src/lib/civics.ts) ----

/** Questions a mock test can ask: never local ones (they can't be checked here); only starred ones under 65/20. */
export function mockPool(questions: CivicsQuestion[], senior: boolean): CivicsQuestion[] {
  return questions.filter((q) => q.kind !== "local" && (!senior || q.star));
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
