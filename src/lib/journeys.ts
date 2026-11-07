import { formInfo } from "./case-insights";
import { statusCategory } from "./status-category";
import { findStatusGuide } from "./status-guide";

/**
 * The case's line map: the steps its kind of case goes through (a green card,
 * a work permit, a family petition, citizenship…), which step it has reached,
 * and when each step happened, from USCIS's own history and the changes
 * CasePingo saw. Plain TypeScript: the website renders it, and the app gets it
 * from the API. It only describes what usually happens; USCIS's wording is
 * always the official status.
 */

type Bilingual = { en: string; es: string };

/** What a USCIS status means for the case's progress. */
export type Phase = "received" | "biometrics" | "review" | "interview" | "decision" | "produce" | "mailed" | "delivered" | "state" | "oath";
const PHASE_ORDER: Phase[] = ["received", "biometrics", "review", "interview", "decision", "produce", "mailed", "delivered", "state", "oath"];

const PHASE_BY_SLUG: Record<string, Phase> = {
  "case-was-received": "received",
  "fingerprint-fee-was-received": "received",
  "fees-were-waived": "received",
  "biometrics-appointment-was-scheduled": "biometrics",
  "fingerprints-were-taken": "biometrics",
  "case-is-being-actively-reviewed": "review",
  "request-for-evidence-was-sent": "review",
  "request-for-initial-evidence-was-sent": "review",
  "response-to-request-for-evidence-was-received": "review",
  "notice-explaining-uscis-actions-was-mailed": "review",
  "case-was-reopened": "review",
  "interview-was-scheduled": "interview",
  "interview-was-completed": "interview",
  "interview-was-cancelled": "interview",
  "ready-to-be-scheduled-for-an-interview": "interview",
  "request-to-reschedule-was-received": "interview",
  "case-was-approved": "decision",
  "approval-was-reaffirmed": "decision",
  "case-was-denied": "decision",
  "case-was-rejected": "decision",
  "withdrawal-acknowledgement-notice-was-sent": "decision",
  "case-closed-benefit-received-by-other-means": "decision",
  "new-card-is-being-produced": "produce",
  "card-was-mailed": "mailed",
  "card-was-picked-up-by-usps": "mailed",
  "document-was-mailed": "mailed",
  "mail-was-returned-to-uscis": "mailed",
  "card-was-delivered": "delivered",
  "case-was-sent-to-the-department-of-state": "state",
  "oath-ceremony-was-scheduled": "oath",
};
/** Statuses that say nothing about progress (a transfer, updated details, an expedite request): the line stays where it was. */
const SIDE_SLUGS = new Set(["case-was-transferred", "information-was-updated", "expedite-request-received", "expedite-request-denied"]);

type StepDef = { key: string; label: Bilingual; phases: Phase[] };
const S = {
  received: { key: "received", label: { en: "Received", es: "Recibido" }, phases: ["received"] },
  biometrics: { key: "biometrics", label: { en: "Biometrics", es: "Datos biométricos" }, phases: ["biometrics"] },
  review: { key: "review", label: { en: "Review", es: "Revisión" }, phases: ["review", "interview"] },
  reviewOnly: { key: "review", label: { en: "Review", es: "Revisión" }, phases: ["review"] },
  /** Citizenship and asylum: reviewing leads to the interview. */
  interview: { key: "interview", label: { en: "Interview", es: "Entrevista" }, phases: ["review", "interview"] },
  decision: { key: "decision", label: { en: "Decision", es: "Decisión" }, phases: ["decision"] },
  cardMailed: { key: "card-mailed", label: { en: "Card mailed", es: "Tarjeta enviada" }, phases: ["produce", "mailed"] },
  cardDelivered: { key: "card-delivered", label: { en: "Card delivered", es: "Tarjeta entregada" }, phases: ["delivered"] },
  documentMailed: { key: "document-mailed", label: { en: "Document mailed", es: "Documento enviado" }, phases: ["produce", "mailed", "delivered"] },
  state: { key: "state", label: { en: "Visa center (if abroad)", es: "Centro de visas (si está fuera)" }, phases: ["state"] },
  oath: { key: "oath", label: { en: "Oath ceremony", es: "Juramentación" }, phases: ["oath"] },
  after: { key: "after", label: { en: "After the decision", es: "Después de la decisión" }, phases: ["produce", "mailed", "delivered", "state", "oath"] },
} satisfies Record<string, StepDef>;

export type ScenarioKey = "green-card" | "work-permit" | "card-replacement" | "remove-conditions" | "citizenship" | "travel-document" | "asylum" | "family-petition" | "fiance" | "asylee-relative" | "petition" | "general";
type ScenarioDef = { key: ScenarioKey; name: Bilingual; steps: StepDef[] };

const CARD_STEPS = [S.received, S.biometrics, S.review, S.decision, S.cardMailed, S.cardDelivered];
const SCENARIOS: Record<ScenarioKey, ScenarioDef> = {
  "green-card": { key: "green-card", name: { en: "Green card", es: "Tarjeta de residencia" }, steps: CARD_STEPS },
  "work-permit": { key: "work-permit", name: { en: "Work permit", es: "Permiso de trabajo" }, steps: CARD_STEPS },
  "card-replacement": { key: "card-replacement", name: { en: "Green card renewal or replacement", es: "Renovación o reemplazo de la tarjeta" }, steps: CARD_STEPS },
  "remove-conditions": { key: "remove-conditions", name: { en: "Removing conditions on residence", es: "Cancelar las condiciones de residencia" }, steps: CARD_STEPS },
  citizenship: { key: "citizenship", name: { en: "Citizenship", es: "Ciudadanía" }, steps: [S.received, S.biometrics, S.interview, S.decision, S.oath] },
  "travel-document": { key: "travel-document", name: { en: "Travel document", es: "Documento de viaje" }, steps: [S.received, S.biometrics, S.review, S.decision, S.documentMailed] },
  asylum: { key: "asylum", name: { en: "Asylum", es: "Asilo" }, steps: [S.received, S.biometrics, S.interview, S.decision] },
  "family-petition": { key: "family-petition", name: { en: "Family petition", es: "Petición familiar" }, steps: [S.received, S.review, S.decision, S.state] },
  fiance: { key: "fiance", name: { en: "Fiancé(e) petition", es: "Petición de prometido(a)" }, steps: [S.received, S.review, S.decision, S.state] },
  "asylee-relative": { key: "asylee-relative", name: { en: "Asylee or refugee relative", es: "Familiar de asilado o refugiado" }, steps: [S.received, S.review, S.decision, S.state] },
  petition: { key: "petition", name: { en: "Petition", es: "Petición" }, steps: [S.received, S.reviewOnly, S.decision] },
  general: { key: "general", name: { en: "Your case", es: "Su caso" }, steps: [S.received, S.review, S.decision, S.after] },
};

const SCENARIO_BY_FORM: Record<string, ScenarioKey> = {
  "I-485": "green-card",
  "I-765": "work-permit",
  "I-90": "card-replacement",
  "I-751": "remove-conditions",
  "I-829": "remove-conditions",
  "N-400": "citizenship",
  "I-131": "travel-document",
  "I-589": "asylum",
  "I-130": "family-petition",
  "I-129F": "fiance",
  "I-730": "asylee-relative",
  "I-140": "petition",
  "I-129": "petition",
  "I-360": "petition",
  "I-526E": "petition",
};

/** The kind of case, from its form ("I-485" → green card). */
export function scenarioFor(formType: string | null | undefined): ScenarioDef {
  const code = formInfo(formType)?.code ?? "";
  return SCENARIOS[SCENARIO_BY_FORM[code] ?? "general"];
}

export type StepState = "done" | "current" | "upcoming";
export type Tone = "progress" | "action" | "done" | "stop";
export type Outcome = "approved" | "denied" | "rejected" | "withdrawn" | "closed" | null;
export type LineMapStep = { key: string; label: Bilingual; state: StepState; /** "YYYY-MM-DD" when known. */ date: string | null };
export type LineMap = {
  scenario: ScenarioKey;
  name: Bilingual;
  steps: LineMapStep[];
  /** Index of the current step, or -1 before the first check. */
  current: number;
  tone: Tone;
  /** Short words for the marker above the current step ("Interview scheduled", "Denied"). */
  marker: Bilingual | null;
  outcome: Outcome;
  /** No more steps are expected (delivered, oath, sent on, denied…). */
  finished: boolean;
};

/** A status seen at some point: from USCIS's history, or a change CasePingo saw. */
export type StatusPoint = { titleEn: string | null | undefined; date: string | null };

const MARKERS: Record<string, { text: Bilingual; tone?: Tone }> = {
  "request-for-evidence-was-sent": { text: { en: "Evidence requested", es: "Evidencia solicitada" }, tone: "action" },
  "request-for-initial-evidence-was-sent": { text: { en: "Evidence requested", es: "Evidencia solicitada" }, tone: "action" },
  "notice-explaining-uscis-actions-was-mailed": { text: { en: "Notice mailed", es: "Aviso enviado" }, tone: "action" },
  "response-to-request-for-evidence-was-received": { text: { en: "Response received", es: "Respuesta recibida" } },
  "case-is-being-actively-reviewed": { text: { en: "In review", es: "En revisión" } },
  "case-was-reopened": { text: { en: "Reopened", es: "Reabierto" } },
  "biometrics-appointment-was-scheduled": { text: { en: "Appointment scheduled", es: "Cita programada" }, tone: "action" },
  "fingerprints-were-taken": { text: { en: "Fingerprints taken", es: "Huellas tomadas" } },
  "interview-was-scheduled": { text: { en: "Interview scheduled", es: "Entrevista programada" }, tone: "action" },
  "interview-was-completed": { text: { en: "Interview done", es: "Entrevista realizada" } },
  "interview-was-cancelled": { text: { en: "Interview cancelled", es: "Entrevista cancelada" } },
  "ready-to-be-scheduled-for-an-interview": { text: { en: "Waiting for an interview", es: "En espera de entrevista" } },
  "case-was-approved": { text: { en: "Approved", es: "Aprobado" }, tone: "done" },
  "approval-was-reaffirmed": { text: { en: "Approved", es: "Aprobado" }, tone: "done" },
  "case-was-denied": { text: { en: "Denied", es: "Negado" }, tone: "stop" },
  "case-was-rejected": { text: { en: "Rejected", es: "Rechazado" }, tone: "stop" },
  "withdrawal-acknowledgement-notice-was-sent": { text: { en: "Withdrawn", es: "Retirado" }, tone: "stop" },
  "case-closed-benefit-received-by-other-means": { text: { en: "Closed", es: "Cerrado" }, tone: "stop" },
  "new-card-is-being-produced": { text: { en: "Card being made", es: "Tarjeta en producción" }, tone: "done" },
  "card-was-picked-up-by-usps": { text: { en: "With the post office", es: "En el correo" }, tone: "done" },
  "mail-was-returned-to-uscis": { text: { en: "Mail returned", es: "Correo devuelto" }, tone: "action" },
};
const OUTCOMES: Record<string, Outcome> = {
  "case-was-denied": "denied",
  "case-was-rejected": "rejected",
  "withdrawal-acknowledgement-notice-was-sent": "withdrawn",
  "case-closed-benefit-received-by-other-means": "closed",
};

const slugOf = (titleEn: string | null | undefined) => findStatusGuide(titleEn)?.slug ?? null;
const OPTIONAL_STEPS = new Set(["state", "after"]);

/** Where a USCIS status sits in a case's journey (received, biometrics, review…), or null for side statuses and unknown wording. */
export function phaseOf(titleEn: string | null | undefined): Phase | null {
  const slug = slugOf(titleEn);
  return slug && slug in PHASE_BY_SLUG ? PHASE_BY_SLUG[slug] : null;
}

/** The step a phase belongs to in this scenario; a phase the scenario doesn't have counts as the nearest earlier one. */
function stepForPhase(steps: StepDef[], phase: Phase): number {
  for (let p = PHASE_ORDER.indexOf(phase); p >= 0; p--) {
    const i = steps.findIndex((s) => s.phases.includes(PHASE_ORDER[p]));
    if (i >= 0) return i;
  }
  return 0;
}
function stepForTitle(steps: StepDef[], titleEn: string | null | undefined): number | null {
  const slug = slugOf(titleEn);
  if (slug && slug in PHASE_BY_SLUG) return stepForPhase(steps, PHASE_BY_SLUG[slug]);
  return null;
}

/** "YYYY-MM-DD" from an ISO date, a USCIS local date ("2024-02-26T00:00:00") or "MM-DD-YYYY". */
export function dayOf(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{2})-(\d{2})-(\d{4})/.exec(value);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
/** Whole days from a to b ("YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Where the case is on its line map.
 * - The current status decides the step (cases can go back, e.g. reopened).
 * - Side statuses (a transfer, updated details) keep the furthest step reached.
 * - Each reached step gets the date it first happened; earlier steps the case
 *   passed without a record of them (no interview, no biometrics) are just done.
 */
export function lineMapFor(input: { formType: string | null | undefined; currentTitleEn: string | null | undefined; currentDate?: string | null; history: StatusPoint[] }): LineMap {
  const scenario = scenarioFor(input.formType);
  const steps = scenario.steps;
  const blank = (state: StepState): LineMapStep[] => steps.map((s) => ({ key: s.key, label: s.label, state, date: null }));
  if (!input.currentTitleEn) return { scenario: scenario.key, name: scenario.name, steps: blank("upcoming"), current: -1, tone: "progress", marker: null, outcome: null, finished: false };

  // First date seen for each step.
  const dates = new Map<number, string>();
  let furthest = 0;
  const points = [...input.history, { titleEn: input.currentTitleEn, date: input.currentDate ?? null }];
  for (const p of points) {
    const i = stepForTitle(steps, p.titleEn);
    if (i === null) continue;
    furthest = Math.max(furthest, i);
    const day = dayOf(p.date);
    if (day && (!dates.has(i) || day < dates.get(i)!)) dates.set(i, day);
  }

  const slug = slugOf(input.currentTitleEn);
  const category = statusCategory(input.currentTitleEn);
  let current: number;
  if (slug && slug in PHASE_BY_SLUG) current = stepForPhase(steps, PHASE_BY_SLUG[slug]);
  else if (slug && SIDE_SLUGS.has(slug)) current = Math.max(furthest, Math.min(1, steps.length - 1));
  else current = category === "done" || category === "stop" ? stepForPhase(steps, "decision") : Math.max(furthest, Math.min(1, steps.length - 1));

  const decision = stepForPhase(steps, "decision");
  const outcome: Outcome = slug && OUTCOMES[slug] ? OUTCOMES[slug] : category === "stop" ? (current >= decision ? "closed" : null) : current >= decision ? "approved" : null;
  const marker = slug && MARKERS[slug] ? MARKERS[slug] : null;
  const tone: Tone = marker?.tone ?? (category === "none" ? "progress" : category);
  const stopped = outcome !== null && outcome !== "approved";
  // Steps that only happen for some cases (the visa center when the relative is abroad) don't keep an approved case open.
  const finished = stopped || current === steps.length - 1 || (outcome === "approved" && steps.slice(current + 1).every((st) => OPTIONAL_STEPS.has(st.key)));

  return {
    scenario: scenario.key,
    name: scenario.name,
    steps: steps.map((s, i) => ({ key: s.key, label: s.label, state: i < current ? "done" : i === current ? "current" : "upcoming", date: i <= current ? (dates.get(i) ?? null) : null })),
    current,
    tone,
    marker: marker?.text ?? steps[current].label,
    outcome,
    finished,
  };
}

/** Day counts for the case card and details: filed, total days and days since the last update. */
export function caseDays(input: { filed: string | null; lastUpdate: string | null; finished: boolean; today: string }): { filed: string | null; lastUpdate: string | null; total: number | null; sinceUpdate: number | null } {
  const end = input.finished && input.lastUpdate ? input.lastUpdate : input.today;
  return {
    filed: input.filed,
    lastUpdate: input.lastUpdate,
    total: input.filed ? Math.max(0, daysBetween(input.filed, end)) : null,
    sinceUpdate: input.lastUpdate ? Math.max(0, daysBetween(input.lastUpdate, input.today)) : null,
  };
}

/** What the line map needs from a stored case (any of the case queries). */
export type CaseForLineMap = {
  formType: string | null;
  statusTitleEn: string | null;
  /** USCIS's history as stored: [{ date: { raw, local }, textEn }]. */
  uscisHistory?: unknown;
  uscisSubmittedRaw?: string | null;
  uscisModifiedRaw?: string | null;
  lastChangeObservedAt?: Date | null;
  /** Changes CasePingo saw, when the query has them. */
  events?: { statusTitleEn: string | null; uscisReportedRaw?: string | null; firstObservedAt: Date }[];
};

type StoredHistory = { date?: { raw?: string | null; local?: string | null } | null; textEn?: string | null };

export type CaseJourney = { lineMap: LineMap; days: ReturnType<typeof caseDays> };

/** The line map and day counts for a stored case. */
export function caseJourney(c: CaseForLineMap, now: Date = new Date()): CaseJourney {
  const history = Array.isArray(c.uscisHistory) ? (c.uscisHistory as StoredHistory[]) : [];
  const points: StatusPoint[] = [
    ...history.map((h) => ({ titleEn: h?.textEn ?? null, date: h?.date?.local ?? h?.date?.raw ?? null })),
    ...(c.events ?? []).map((e) => ({ titleEn: e.statusTitleEn, date: dayOf(e.uscisReportedRaw) ?? dayOf(e.firstObservedAt) })),
  ];
  const lastUpdate = dayOf(c.uscisModifiedRaw) ?? dayOf(c.lastChangeObservedAt ?? null);
  const lineMap = lineMapFor({ formType: c.formType, currentTitleEn: c.statusTitleEn, currentDate: lastUpdate, history: points });
  const known = points.map((p) => dayOf(p.date)).filter((d): d is string => Boolean(d)).sort();
  const filed = dayOf(c.uscisSubmittedRaw) ?? lineMap.steps[0]?.date ?? known[0] ?? null;
  return { lineMap, days: caseDays({ filed, lastUpdate, finished: lineMap.finished, today: dayOf(now)! }) };
}
