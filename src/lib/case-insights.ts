import { statusCategory } from "./status-category";
import { findStatusGuide } from "./status-guide";

/**
 * Small, factual extras shown with a case: which USCIS office received it
 * (from the receipt number's 3-letter prefix), the form's name, a link to
 * USCIS's official processing times, and whether CasePingo saw the case
 * become approved recently (for the congratulations moment).
 *
 * USCIS has no official processing-times API (only an undocumented endpoint
 * behind its public tool), so we link to the official page instead of
 * copying numbers that could be stale or wrong.
 */

export const PROCESSING_TIMES_URL = "https://egov.uscis.gov/processing-times/";

type Bilingual = { en: string; es: string };

const OFFICES: Record<string, Bilingual> = {
  EAC: { en: "Vermont Service Center", es: "Centro de Servicio de Vermont" },
  VSC: { en: "Vermont Service Center", es: "Centro de Servicio de Vermont" },
  WAC: { en: "California Service Center", es: "Centro de Servicio de California" },
  CSC: { en: "California Service Center", es: "Centro de Servicio de California" },
  LIN: { en: "Nebraska Service Center", es: "Centro de Servicio de Nebraska" },
  NSC: { en: "Nebraska Service Center", es: "Centro de Servicio de Nebraska" },
  SRC: { en: "Texas Service Center", es: "Centro de Servicio de Texas" },
  TSC: { en: "Texas Service Center", es: "Centro de Servicio de Texas" },
  MSC: { en: "National Benefits Center", es: "Centro Nacional de Beneficios" },
  NBC: { en: "National Benefits Center", es: "Centro Nacional de Beneficios" },
  YSC: { en: "Potomac Service Center", es: "Centro de Servicio de Potomac" },
  IOE: { en: "USCIS online system (ELIS)", es: "Sistema en línea de USCIS (ELIS)" },
};

export type ReceivingOffice = { code: string; name: Bilingual | null };

/** Office that received the case, from the receipt prefix ("EAC*******402" → Vermont). */
export function receivingOffice(receiptMasked: string | null | undefined): ReceivingOffice | null {
  const code = /^([A-Za-z]{3})/.exec(receiptMasked ?? "")?.[1]?.toUpperCase();
  if (!code) return null;
  return { code, name: OFFICES[code] ?? null };
}

const FORMS: Record<string, Bilingual> = {
  "I-90": { en: "Application to Replace Permanent Resident Card", es: "Solicitud para Reemplazar la Tarjeta de Residente Permanente" },
  "I-129": { en: "Petition for a Nonimmigrant Worker", es: "Petición de Trabajador No Inmigrante" },
  "I-129F": { en: "Petition for Alien Fiancé(e)", es: "Petición de Prometido(a) Extranjero(a)" },
  "I-130": { en: "Petition for Alien Relative", es: "Petición de Familiar Extranjero" },
  "I-131": { en: "Application for Travel Document", es: "Solicitud de Documento de Viaje" },
  "I-140": { en: "Immigrant Petition for Alien Worker", es: "Petición de Inmigrante para Trabajador Extranjero" },
  "I-360": { en: "Petition for Amerasian, Widow(er), or Special Immigrant", es: "Petición de Amerasiático, Viudo(a) o Inmigrante Especial" },
  "I-485": { en: "Application to Register Permanent Residence or Adjust Status", es: "Solicitud de Registro de Residencia Permanente o Ajuste de Estatus" },
  "I-526E": { en: "Immigrant Petition by Regional Center Investor", es: "Petición de Inmigrante por Inversionista de Centro Regional" },
  "I-539": { en: "Application to Extend/Change Nonimmigrant Status", es: "Solicitud para Extender/Cambiar Estatus de No Inmigrante" },
  "I-589": { en: "Application for Asylum and for Withholding of Removal", es: "Solicitud de Asilo y de Suspensión de Expulsión" },
  "I-601A": { en: "Application for Provisional Unlawful Presence Waiver", es: "Solicitud de Exención Provisional por Presencia Ilegal" },
  "I-730": { en: "Refugee/Asylee Relative Petition", es: "Petición de Familiar de Refugiado/Asilado" },
  "I-751": { en: "Petition to Remove Conditions on Residence", es: "Petición para Cancelar las Condiciones de Residencia" },
  "I-765": { en: "Application for Employment Authorization", es: "Solicitud de Autorización de Empleo" },
  "I-821": { en: "Application for Temporary Protected Status", es: "Solicitud de Estatus de Protección Temporal" },
  "I-821D": { en: "Consideration of Deferred Action for Childhood Arrivals", es: "Consideración de Acción Diferida para los Llegados en la Infancia" },
  "I-829": { en: "Petition by Investor to Remove Conditions on Permanent Resident Status", es: "Petición del Inversionista para Cancelar las Condiciones de Residencia Permanente" },
  "I-918": { en: "Petition for U Nonimmigrant Status", es: "Petición de Estatus de No Inmigrante U" },
  "N-400": { en: "Application for Naturalization", es: "Solicitud de Naturalización" },
  "N-600": { en: "Application for Certificate of Citizenship", es: "Solicitud de Certificado de Ciudadanía" },
};

export type FormInfo = { code: string; name: Bilingual | null };

/** "I130", "i-130" or "I-130" → { code: "I-130", name }. */
export function formInfo(formType: string | null | undefined): FormInfo | null {
  const m = /^\s*([A-Za-z]{1,3})-?(\d{1,4}[A-Za-z]{0,2})\s*$/.exec(formType ?? "");
  if (!m) return formType?.trim() ? { code: formType.trim(), name: null } : null;
  const code = `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
  return { code, name: FORMS[code] ?? null };
}

// ---- Approval moment ---------------------------------------------------------

/** How long after CasePingo sees an approval the congratulations card stays up. */
export const CELEBRATION_WINDOW_DAYS = 30;

type ObservedEvent = { statusTitleEn: string | null; firstObservedAt: Date };

/**
 * When CasePingo first saw this case become approved, or null.
 * Only counts approvals we watched happen (an approved status after an
 * earlier, not-yet-approved one), so adding a case that was already approved
 * doesn't trigger a celebration.
 */
export function observedApprovalAt(currentTitleEn: string | null | undefined, events: ObservedEvent[]): Date | null {
  if (statusCategory(currentTitleEn) !== "done") return null;
  const ordered = [...events].sort((a, b) => a.firstObservedAt.getTime() - b.firstObservedAt.getTime());
  let sawPending = false;
  for (const e of ordered) {
    const cat = statusCategory(e.statusTitleEn);
    if (cat === "done") {
      if (sawPending) return e.firstObservedAt;
    } else if (cat !== "none") {
      sawPending = true;
    }
  }
  return null;
}

/** The approval moment, only while it's recent enough to celebrate. */
export function recentApprovalAt(currentTitleEn: string | null | undefined, events: ObservedEvent[], now: Date = new Date()): Date | null {
  const at = observedApprovalAt(currentTitleEn, events);
  if (!at) return null;
  return now.getTime() - at.getTime() <= CELEBRATION_WINDOW_DAYS * 86_400_000 ? at : null;
}

// ---- What comes after an approval -------------------------------------------

const CARD_FORMS = new Set(["I-485", "I-90", "I-751", "I-829", "I-765", "I-821", "I-821D"]);
const AFTER_APPROVAL: Record<string, Bilingual> = {
  card: {
    en: "Next, USCIS produces your card and mails it to the address it has on file.",
    es: "Ahora USCIS produce su tarjeta y la envía por correo a la dirección que tiene registrada.",
  },
  "N-400": {
    en: "Next, USCIS schedules your oath ceremony. You become a U.S. citizen when you take the oath.",
    es: "Ahora USCIS programa su ceremonia de juramentación. Usted se convierte en ciudadano de EE. UU. al prestar el juramento.",
  },
  "I-130": {
    en: "If your relative is outside the U.S., the case goes next to the Department of State's National Visa Center.",
    es: "Si su familiar está fuera de EE. UU., el caso pasa ahora al Centro Nacional de Visas del Departamento de Estado.",
  },
  "I-129F": {
    en: "Next, the case goes to the Department of State for the fiancé(e) visa process.",
    es: "Ahora el caso pasa al Departamento de Estado para el trámite de la visa de prometido(a).",
  },
  "I-131": {
    en: "Next, USCIS mails your travel document.",
    es: "Ahora USCIS le envía por correo su documento de viaje.",
  },
};

/**
 * One sentence for the congratulations card. Right after "Case Was Approved"
 * it depends on the form; once the case has moved on (card produced, mailed,
 * oath scheduled…) the current status's own "what's next" is more accurate.
 */
export function approvalNextStep(formType: string | null | undefined, currentTitleEn: string | null | undefined): Bilingual | null {
  const g = findStatusGuide(currentTitleEn);
  if (!g || g.slug === "case-was-approved") {
    const code = formInfo(formType)?.code ?? "";
    const specific = AFTER_APPROVAL[CARD_FORMS.has(code) ? "card" : code];
    if (specific) return specific;
  }
  return g ? g.next : null;
}
