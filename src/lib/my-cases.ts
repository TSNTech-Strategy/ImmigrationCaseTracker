import { CELEBRATION_WINDOW_DAYS, formInfo } from "./case-insights";
import { dayOf, daysBetween, phaseOf, type CaseJourney } from "./journeys";
import { SITE } from "./site";
import { statusCategory, type StatusCategory } from "./status-category";
import { findStatusGuide } from "./status-guide";

/**
 * My cases at a glance: summary tiles that filter the list, the list in
 * groups, a short next step for every status, and the "share my journey"
 * text for an approved case. Plain TypeScript: the website renders it and the
 * API sends the per-case parts to the app.
 *
 * - The next step is general information in a few words, never legal advice;
 *   the case page has the full explanation and USCIS's own wording.
 * - The share text never contains the receipt number or the nickname.
 */

type Bilingual = { en: string; es: string };
export type Lang = "en" | "es";

// ---- Next step ------------------------------------------------------------------

const SAME = {
  watchMail: { en: "Watch your mail for the next notice", es: "Esté atento al próximo aviso por correo" },
  noAction: { en: "No action needed; watch for updates", es: "No necesita hacer nada; espere novedades" },
  evidence: { en: "Send the evidence by the deadline", es: "Envíe la evidencia antes de la fecha límite" },
  done: { en: "No action needed", es: "No necesita hacer nada" },
  cardMail: { en: "Watch for your card in the mail", es: "Esté atento a su tarjeta por correo" },
  visaCenter: { en: "Watch for news from the visa center", es: "Esté atento a noticias del centro de visas" },
} satisfies Record<string, Bilingual>;

/** A few words on what to do now, for every status in the status guide (keyed by its slug). */
export const NEXT_STEPS: Record<string, Bilingual> = {
  "case-was-received": SAME.watchMail,
  "fingerprint-fee-was-received": { en: "Watch for your biometrics notice", es: "Esté atento al aviso de datos biométricos" },
  "biometrics-appointment-was-scheduled": { en: "Go to your biometrics appointment", es: "Asista a su cita de datos biométricos" },
  "fingerprints-were-taken": { en: "No action needed; review continues", es: "No necesita hacer nada; sigue la revisión" },
  "case-is-being-actively-reviewed": SAME.noAction,
  "request-for-evidence-was-sent": SAME.evidence,
  "request-for-initial-evidence-was-sent": SAME.evidence,
  "response-to-request-for-evidence-was-received": { en: "Wait while USCIS reviews your response", es: "Espere mientras USCIS revisa su respuesta" },
  "interview-was-scheduled": { en: "Prepare for your interview", es: "Prepárese para su entrevista" },
  "interview-was-completed": { en: "Wait for the decision", es: "Espere la decisión" },
  "interview-was-cancelled": { en: "Watch your mail for a new notice", es: "Esté atento a un nuevo aviso por correo" },
  "ready-to-be-scheduled-for-an-interview": { en: "Watch for your interview notice", es: "Esté atento a su aviso de entrevista" },
  "request-to-reschedule-was-received": { en: "Watch for your new appointment notice", es: "Esté atento al aviso de su nueva cita" },
  "case-was-transferred": { en: "No action needed; watch your mail", es: "No necesita hacer nada; revise su correo" },
  "expedite-request-received": { en: "Wait for USCIS's answer", es: "Espere la respuesta de USCIS" },
  "expedite-request-denied": { en: "Your case continues in normal order", es: "Su caso sigue en el orden normal" },
  "fees-were-waived": SAME.watchMail,
  "information-was-updated": { en: "Check that the change is correct", es: "Verifique que el cambio sea correcto" },
  "case-was-reopened": { en: "Watch for new instructions", es: "Esté atento a nuevas instrucciones" },
  "notice-explaining-uscis-actions-was-mailed": { en: "Read the notice and follow it", es: "Lea el aviso y siga sus instrucciones" },
  "case-was-approved": { en: "Watch for your approval notice", es: "Esté atento a su aviso de aprobación" },
  "approval-was-reaffirmed": { en: "Watch for news from the consulate", es: "Esté atento a noticias del consulado" },
  "new-card-is-being-produced": SAME.cardMail,
  "card-was-mailed": { en: "Check your mailbox for your card", es: "Revise su buzón: su tarjeta va en camino" },
  "card-was-picked-up-by-usps": { en: "Track the delivery with USPS", es: "Siga la entrega con USPS" },
  "card-was-delivered": { en: "Check your card for mistakes", es: "Revise que su tarjeta no tenga errores" },
  "document-was-mailed": { en: "Check your mailbox for your document", es: "Revise su buzón: su documento va en camino" },
  "case-was-sent-to-the-department-of-state": SAME.visaCenter,
  "oath-ceremony-was-scheduled": { en: "Go to your oath ceremony", es: "Asista a su ceremonia de juramentación" },
  "mail-was-returned-to-uscis": { en: "Update your address with USCIS", es: "Actualice su dirección con USCIS" },
  "case-was-denied": { en: "Read the notice; consider legal help", es: "Lea el aviso; considere ayuda legal" },
  "case-was-rejected": { en: "Read the notice before filing again", es: "Lea el aviso antes de volver a presentar" },
  "withdrawal-acknowledgement-notice-was-sent": SAME.done,
  "case-closed-benefit-received-by-other-means": SAME.done,
};

/** Right after an approval, what comes next depends on the form. */
const CARD_FORMS = new Set(["I-485", "I-90", "I-751", "I-829", "I-765", "I-821", "I-821D"]);
const APPROVED_BY_FORM: Record<string, Bilingual> = {
  card: SAME.cardMail,
  "N-400": { en: "Watch for your oath ceremony notice", es: "Esté atento al aviso de su juramentación" },
  "I-129F": SAME.visaCenter,
  "I-131": { en: "Watch for your travel document", es: "Esté atento a su documento de viaje" },
};

/** Wording the guide doesn't cover yet: a safe step from the kind of status. */
const BY_CATEGORY: Record<StatusCategory, Bilingual> = {
  none: { en: "Waiting for the first check", es: "Esperando la primera consulta" },
  action: { en: "Read your latest USCIS notice", es: "Lea su aviso más reciente de USCIS" },
  done: { en: "Keep your USCIS notices safe", es: "Guarde sus avisos de USCIS" },
  stop: { en: "Read the notice from USCIS", es: "Lea el aviso de USCIS" },
  progress: SAME.noAction,
};

/** The next step for a case's current status ("Prepare for your interview"). */
export function nextStepFor(titleEn: string | null | undefined, formType?: string | null): Bilingual {
  const g = findStatusGuide(titleEn);
  if (g?.slug === "case-was-approved") {
    const code = formInfo(formType)?.code ?? "";
    return APPROVED_BY_FORM[CARD_FORMS.has(code) ? "card" : code] ?? NEXT_STEPS[g.slug];
  }
  return (g && NEXT_STEPS[g.slug]) ?? BY_CATEGORY[statusCategory(titleEn)];
}

// ---- Groups, tiles and filters ------------------------------------------------------

/** Sections of the list, in this order. */
export type CaseGroup = "attention" | "progress" | "completed";
export const GROUP_ORDER: CaseGroup[] = ["attention", "progress", "completed"];

/** What a summary tile (or "View all") shows. */
export type CaseFilter = "attention" | "interview" | "approved" | "active" | "completed";
export const TILE_FILTERS = ["attention", "interview", "approved", "active"] as const satisfies readonly CaseFilter[];
const FILTERS = new Set<string>(["attention", "interview", "approved", "active", "completed"]);
export const parseCaseFilter = (v: unknown): CaseFilter | null => (typeof v === "string" && FILTERS.has(v) ? (v as CaseFilter) : null);

/** Per case: its group, the tiles it counts for, and its next step. */
export type CaseGlance = { group: CaseGroup; interview: boolean; approvedRecently: boolean; nextStep: Bilingual };

/** The day USCIS approved the case: the decision step's date, else when CasePingo saw the approval. */
export function approvalDay(journey: CaseJourney, observedAt?: Date | string | null): string | null {
  if (journey.lineMap.outcome !== "approved") return null;
  const decision = journey.lineMap.steps.find((s) => s.key === "decision");
  return decision?.date ?? dayOf(observedAt ?? null);
}

/**
 * - Needs attention: something to do now (evidence requested, an appointment, mail returned…).
 * - Completed: no more steps are expected (delivered, oath, denied…).
 * - In progress: everything else, including cases not checked yet.
 * - Approved recently: approved in the last 30 days (USCIS's date, or when CasePingo saw it).
 */
export function caseGlance(c: { statusTitleEn: string | null; formType: string | null }, journey: CaseJourney, opts: { now?: Date; observedApprovalAt?: Date | string | null } = {}): CaseGlance {
  const map = journey.lineMap;
  const group: CaseGroup = map.tone === "action" || statusCategory(c.statusTitleEn) === "action" ? "attention" : map.finished ? "completed" : "progress";
  const approvedOn = approvalDay(journey, opts.observedApprovalAt);
  const today = dayOf(opts.now ?? new Date())!;
  const approvedRecently = map.outcome === "approved" && (Boolean(opts.observedApprovalAt) || (approvedOn !== null && daysBetween(approvedOn, today) <= CELEBRATION_WINDOW_DAYS));
  return { group, interview: phaseOf(c.statusTitleEn) === "interview", approvedRecently, nextStep: nextStepFor(c.statusTitleEn, c.formType) };
}

export function matchesFilter(g: Pick<CaseGlance, "group" | "interview" | "approvedRecently">, f: CaseFilter): boolean {
  switch (f) {
    case "attention":
      return g.group === "attention";
    case "interview":
      return g.interview;
    case "approved":
      return g.approvedRecently;
    case "active":
      return g.group !== "completed";
    case "completed":
      return g.group === "completed";
  }
}

/** How many cases each tile (and the completed group) has. */
export function glanceCounts(list: Pick<CaseGlance, "group" | "interview" | "approvedRecently">[]): Record<CaseFilter, number> {
  const out: Record<CaseFilter, number> = { attention: 0, interview: 0, approved: 0, active: 0, completed: 0 };
  for (const g of list) for (const f of Object.keys(out) as CaseFilter[]) if (matchesFilter(g, f)) out[f]++;
  return out;
}

/** How many completed cases the list shows before "View all". */
export const COMPLETED_PREVIEW = 3;

// ---- Share my journey -----------------------------------------------------------------

export type JourneyShare = {
  /** "YYYY-MM-DD" when known. */
  approvedOn: string | null;
  filed: string | null;
  /** Days from filing to the approval. */
  days: number | null;
  /** The steps the case went through, with the day each happened when known. */
  steps: { key: string; label: Bilingual; date: string | null }[];
  /** Ready to share: no receipt number, no nickname. */
  text: Bilingual;
};

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-US" };
/** "October 3, 2026" / "3 de octubre de 2026" from "YYYY-MM-DD" (the day itself, whatever the time zone). */
export function longDay(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** For an approved case: the journey in numbers, and a message the person can share. */
export function journeyShare(c: { formType: string | null }, journey: CaseJourney, observedApprovalAt?: Date | string | null): JourneyShare | null {
  const map = journey.lineMap;
  if (map.outcome !== "approved") return null;
  const approvedOn = approvalDay(journey, observedApprovalAt);
  const filed = journey.days.filed;
  // With no earlier date than the approval itself, how long it took isn't known.
  const days = filed && approvedOn && filed < approvedOn ? daysBetween(filed, approvedOn) : null;
  const steps = map.steps.filter((s) => s.state !== "upcoming").map((s) => ({ key: s.key, label: s.label, date: s.date }));
  const code = formInfo(c.formType)?.code ?? null;
  const named = map.scenario !== "general" && map.scenario !== "petition";

  const text = (lang: Lang) => {
    const what = code
      ? `${lang === "es" ? "Formulario" : "Form"} ${code}${named ? ` (${map.name[lang].toLowerCase()})` : ""}`
      : lang === "es"
        ? "caso"
        : "case";
    const on = approvedOn ? longDay(approvedOn, lang) : null;
    const head =
      lang === "es"
        ? `Mi ${what} fue aprobado${on ? ` el ${on}` : ""}${days !== null ? `, ${days} ${days === 1 ? "día" : "días"} después de presentarlo` : ""}.`
        : `My ${what} was approved${on ? ` on ${on}` : ""}${days !== null ? `, ${days} ${days === 1 ? "day" : "days"} after filing` : ""}.`;
    const lines = steps.filter((s) => s.date).map((s) => `${s.label[lang]}: ${longDay(s.date!, lang)}`);
    const foot = `${lang === "es" ? "Seguimiento con" : "Tracked with"} ${SITE.name}: https://${SITE.domain}`;
    return [head, ...(lines.length ? ["", ...lines] : []), "", foot].join("\n");
  };
  return { approvedOn, filed, days, steps, text: { en: text("en"), es: text("es") } };
}
