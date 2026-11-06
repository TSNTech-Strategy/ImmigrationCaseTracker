/** Types for the naturalization civics test content (see ./index.ts). */

export type Text = { en: string; es: string };

/** Which official list: 2025 (128 questions) or 2008 (100 questions). */
export type CivicsVersion = "2025" | "2008";

/** Answers that change with elections and appointments; filled in from CURRENT in ./index.ts. */
export type CurrentKey = "president" | "vicePresident" | "speaker" | "chiefJustice" | "presidentParty" | "justices";

type Base = {
  /** The official question number. */
  n: number;
  /** Section key (see the version's sections). */
  s: string;
  /** The question, exactly as USCIS writes it. */
  q: string;
  /** Marked with an asterisk: the 20 questions for the 65/20 exception. */
  star?: true;
  /** USCIS's own note for this question (the text it prints in brackets). */
  note?: string;
};

/** A question with fixed official answers, plus one correct and three wrong choices for practice. */
export type FixedQuestion = Base & {
  /** The official answers, exactly as written. Any one of them is accepted (or `pick` of them). */
  a: string[];
  /** How many answers the question asks for ("Name two ..."), when more than one. */
  pick?: number;
  /** The correct choice shown in practice. */
  right: string;
  /** Three wrong choices for practice: never an accepted answer. */
  wrong: [string, string, string];
};

/** "Who is ... now?": USCIS lists the current answer on its test updates page. */
export type CurrentQuestion = Base & { current: CurrentKey };

/** Depends on where the applicant lives (their senators, representative, governor, state capital). */
export type LocalQuestion = Base & { local: true };

export type RawQuestion = FixedQuestion | CurrentQuestion | LocalQuestion;

export type CivicsSection = { key: string; group: Text; title: Text };

/** A question ready to show: current answers filled in, the same shape for every kind. */
export type CivicsQuestion = {
  /** "2025-38" */
  id: string;
  n: number;
  section: string;
  q: string;
  answers: string[];
  note?: string;
  star: boolean;
  kind: "fixed" | "current" | "local";
  /** How many answers the question asks for (1 unless "Name two/three/five"). */
  pick: number;
  /** Practice choices; absent for local questions, which can't be multiple choice. */
  right?: string;
  wrong?: string[];
};

/** The official test format: how many questions are asked and the scores that end it. */
export type TestRules = { ask: number; pass: number; failAt: number };
