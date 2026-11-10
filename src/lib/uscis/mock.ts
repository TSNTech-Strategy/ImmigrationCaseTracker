import { isValidReceiptNumber, normalizeReceiptNumber, SANDBOX_RECEIPTS } from "@/lib/receipt";
import { UscisError, type UscisErrorKind } from "./errors";
import { normalizeCaseStatus } from "./normalize";
import type { CaseStatusResult } from "./client";

// Deterministic fake USCIS for local development and tests — the equivalent
// of Scanvio's MockSpApiClient. Never used on production (see
// assertRealUscisInProduction).
//
// Receipt endings that return each error the Case Status API documents, with
// USCIS's documented message (swagger_3.yaml), for demos and tests:
//   …0401 → 401 unauthorized   …0404 → 404 not found   …0422 → 422 bad format
//   …0429 → 429 rate limited   …0500 → 503 unavailable
//   anything else → a status picked from the digits

const STATUSES = [
  ["Case Was Received", "Caso Fue Recibido"],
  ["Fingerprint Fee Was Received", "Pago de Huellas Dactilares Fue Recibido"],
  ["Interview Was Scheduled", "Entrevista Fue Programada"],
  ["Request for Additional Evidence Was Sent", "Solicitud de Evidencia Adicional Fue Enviada"],
  ["Case Was Approved", "Caso Fue Aprobado"],
  ["Card Was Mailed To Me", "Tarjeta Fue Enviada"],
] as const;

const MOCK_ERRORS: Record<string, { kind: UscisErrorKind; httpStatus: number; message: string }> = {
  "0401": { kind: "auth", httpStatus: 401, message: "Invalid Access Token" },
  "0404": {
    kind: "not_found",
    httpStatus: 404,
    message:
      "Case Status Online does not recognize the receipt number entered. Please check your receipt number and try again. If you need further assistance, please call the USCIS Contact Center at 1-800-375-5283.",
  },
  "0422": {
    kind: "bad_request",
    httpStatus: 422,
    message:
      "The application receipt number is not formatted correctly, It should be total of 13 characters (3 character prefix followed by 10 digits). Please check your receipt number and try again",
  },
  "0429": { kind: "rate_limited", httpStatus: 429, message: "Spike Arrest Violation" },
  "0500": { kind: "server", httpStatus: 503, message: "Service Unavailable" },
};

export async function mockFetchCaseStatus(receiptInput: string): Promise<CaseStatusResult> {
  const receipt = normalizeReceiptNumber(receiptInput);
  if (!isValidReceiptNumber(receipt)) {
    throw new UscisError("invalid_receipt", "Receipt number must be 3 letters followed by 10 digits");
  }
  const mockError = MOCK_ERRORS[receipt.slice(-4)];
  if (mockError) {
    const { kind, httpStatus, message } = mockError;
    throw new UscisError(kind, `USCIS case-status HTTP ${httpStatus} (mock)`, {
      httpStatus,
      details: [{ code: String(httpStatus), message }],
      retryAfterSeconds: httpStatus === 429 ? 60 : null,
    });
  }

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
