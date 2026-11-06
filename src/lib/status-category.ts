/**
 * Groups USCIS's own status wording into what it means for the person, so the
 * app can colour it consistently. USCIS's exact text is always shown too; this
 * is only a visual aid and never a legal interpretation.
 */
export type StatusCategory = "progress" | "action" | "done" | "stop" | "none";

const RULES: [RegExp, StatusCategory][] = [
  [/denied|rejected|terminated|revoked|withdrawal acknowledged|abandon|was returned|not approved/i, "stop"],
  [/request for (additional )?evidence|rfe|intent to (deny|revoke)|response to .* (was )?received|biometrics appointment was scheduled|interview was scheduled|fingerprint .* scheduled|was mailed .* notice/i, "action"],
  [/approved|approval|card was (mailed|delivered|picked up)|card is being produced|oath ceremony|welcome notice|document was mailed|was delivered|naturaliz/i, "done"],
  [/received|being (actively )?reviewed|fingerprint|transferred|updated|reopened|ready to be scheduled|scheduled|in process|was sent/i, "progress"],
];

export function statusCategory(titleEn: string | null | undefined): StatusCategory {
  if (!titleEn) return "none";
  for (const [re, cat] of RULES) if (re.test(titleEn)) return cat;
  return "progress";
}

export const CATEGORY_LABEL: Record<StatusCategory, { en: string; es: string }> = {
  progress: { en: "In progress", es: "En proceso" },
  action: { en: "Action may be needed", es: "Puede requerir acción" },
  done: { en: "Approved", es: "Aprobado" },
  stop: { en: "Decision", es: "Decisión" },
  none: { en: "Not checked yet", es: "Sin consultar" },
};
