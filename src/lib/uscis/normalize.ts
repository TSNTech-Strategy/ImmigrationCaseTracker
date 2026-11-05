import { createHash } from "node:crypto";
import { z } from "zod";

// Shape of GET /case-status/{receipt} as documented by USCIS. Kept lenient
// (unknown fields allowed, most fields optional) so a harmless USCIS addition
// doesn't break tracking — but a response without a case_status object is
// rejected rather than stored as an empty status.

const text = z.string().nullish();

const historyItem = z.looseObject({
  date: text,
  completed_text_en: text,
  completed_text_es: text,
});

const caseStatus = z.looseObject({
  receiptNumber: text,
  formType: text,
  submittedDate: text,
  modifiedDate: text,
  current_case_status_text_en: text,
  current_case_status_desc_en: text,
  current_case_status_text_es: text,
  current_case_status_desc_es: text,
  hist_case_status: z.array(historyItem).nullish(),
});

export const caseStatusResponseSchema = z.looseObject({ case_status: caseStatus });

/** A date exactly as USCIS reported it, plus our best parse of it. */
export type ReportedDate = {
  raw: string;
  /**
   * "YYYY-MM-DDTHH:mm:ss" with no zone — USCIS doesn't state one, so we don't
   * invent it. Null if the format wasn't recognised.
   */
  local: string | null;
};

export type CaseStatusSnapshot = {
  receiptNumber: string;
  formType: string | null;
  status: {
    en: { title: string | null; description: string | null };
    es: { title: string | null; description: string | null };
  };
  submittedDate: ReportedDate | null;
  modifiedDate: ReportedDate | null;
  /** USCIS-reported history. Not the same as when *we* observed a change. */
  history: { date: ReportedDate | null; textEn: string | null; textEs: string | null }[];
  hasHistory: boolean;
  /** Changes whenever anything meaningful changes — used for change detection. */
  fingerprint: string;
};

/** USCIS sample data uses "MM-DD-YYYY HH:mm:ss"; also accept ISO-like input. */
export function parseReportedDate(raw: string | null | undefined): ReportedDate | null {
  if (!raw || !raw.trim()) return null;
  const v = raw.trim();
  const us = /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  if (us) {
    const [, mm, dd, yyyy, h = "00", m = "00", s = "00"] = us;
    return { raw: v, local: validLocal(`${yyyy}-${mm}-${dd}T${h}:${m}:${s}`) };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  if (iso) {
    const [, yyyy, mm, dd, h = "00", m = "00", s = "00"] = iso;
    return { raw: v, local: validLocal(`${yyyy}-${mm}-${dd}T${h}:${m}:${s}`) };
  }
  return { raw: v, local: null };
}

function validLocal(local: string): string | null {
  const d = new Date(`${local}Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 19) !== local ? null : local;
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function normalizeCaseStatus(body: unknown, requestedReceipt: string): CaseStatusSnapshot {
  const parsed = caseStatusResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error("USCIS response did not contain a valid case_status object");
  const cs = parsed.data.case_status;

  const history = (cs.hist_case_status ?? []).map((h) => ({
    date: parseReportedDate(h.date),
    textEn: clean(h.completed_text_en),
    textEs: clean(h.completed_text_es),
  }));

  const snapshot: Omit<CaseStatusSnapshot, "fingerprint"> = {
    receiptNumber: clean(cs.receiptNumber) ?? requestedReceipt,
    formType: clean(cs.formType),
    status: {
      en: { title: clean(cs.current_case_status_text_en), description: clean(cs.current_case_status_desc_en) },
      es: { title: clean(cs.current_case_status_text_es), description: clean(cs.current_case_status_desc_es) },
    },
    submittedDate: parseReportedDate(cs.submittedDate),
    modifiedDate: parseReportedDate(cs.modifiedDate),
    history,
    hasHistory: history.length > 0,
  };

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        snapshot.formType,
        snapshot.status.en.title,
        snapshot.status.en.description,
        snapshot.modifiedDate?.raw ?? null,
        history.map((h) => [h.date?.raw ?? null, h.textEn]),
      ]),
    )
    .digest("hex");

  return { ...snapshot, fingerprint };
}
