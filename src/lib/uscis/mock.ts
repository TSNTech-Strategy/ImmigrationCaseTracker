import { isValidReceiptNumber, normalizeReceiptNumber, SANDBOX_RECEIPTS } from "@/lib/receipt";
import { UscisError } from "./errors";
import { normalizeCaseStatus } from "./normalize";
import type { CaseStatusResult } from "./client";

// Deterministic fake USCIS for local development and tests — the equivalent
// of Scanvio's MockSpApiClient. Never used on production (see
// assertRealUscisInProduction).
//
//   …0404 → 404 not found      …0429 → 429 rate limited
//   …0500 → 503 server error   anything else → a status picked from the digits

const STATUSES = [
  ["Case Was Received", "Caso Fue Recibido"],
  ["Fingerprint Fee Was Received", "Pago de Huellas Dactilares Fue Recibido"],
  ["Interview Was Scheduled", "Entrevista Fue Programada"],
  ["Request for Additional Evidence Was Sent", "Solicitud de Evidencia Adicional Fue Enviada"],
  ["Case Was Approved", "Caso Fue Aprobado"],
  ["Card Was Mailed To Me", "Tarjeta Fue Enviada"],
] as const;

export async function mockFetchCaseStatus(receiptInput: string): Promise<CaseStatusResult> {
  const receipt = normalizeReceiptNumber(receiptInput);
  if (!isValidReceiptNumber(receipt)) {
    throw new UscisError("invalid_receipt", "Receipt number must be 3 letters followed by 10 digits");
  }
  const tail = receipt.slice(-4);
  if (tail === "0404") throw new UscisError("not_found", "USCIS case-status HTTP 404 (mock)", { httpStatus: 404 });
  if (tail === "0429") throw new UscisError("rate_limited", "USCIS case-status HTTP 429 (mock)", { httpStatus: 429, retryAfterSeconds: 60 });
  if (tail === "0500") throw new UscisError("server", "USCIS case-status HTTP 503 (mock)", { httpStatus: 503 });

  const withHistory = receipt === SANDBOX_RECEIPTS.withHistory || Number(receipt.at(-1)) % 2 === 1;
  const [en, es] = receipt === SANDBOX_RECEIPTS.noHistory
    ? (["Case Approval Was Affirmed", "Aprobación De Caso Reafirmada"] as const)
    : STATUSES[Number(receipt.slice(-2)) % STATUSES.length];

  const body = {
    case_status: {
      receiptNumber: receipt,
      formType: "I-130",
      submittedDate: "09-05-2023 14:28:46",
      modifiedDate: "09-05-2023 14:28:46",
      current_case_status_text_en: en,
      current_case_status_desc_en: `[MOCK] ${en}. This is simulated data, not a real USCIS response.`,
      current_case_status_text_es: es,
      current_case_status_desc_es: `[SIMULADO] ${es}.`,
      hist_case_status: withHistory
        ? [{ date: "08-01-2023", completed_text_en: "Case Was Received", completed_text_es: "Caso Fue Recibido" }]
        : null,
    },
  };
  return { snapshot: normalizeCaseStatus(body, receipt), httpStatus: 200, attempts: 1, durationMs: 0 };
}
