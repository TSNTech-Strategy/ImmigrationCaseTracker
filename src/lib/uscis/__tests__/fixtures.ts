// Shaped like the documented USCIS sandbox sample for EAC9999103402.
export const noHistoryBody = {
  case_status: {
    receiptNumber: "EAC9999103402",
    formType: "I-130",
    submittedDate: "09-05-2023 14:28:46",
    modifiedDate: "09-05-2023 14:28:46",
    current_case_status_text_en: "Case Approval Was Affirmed",
    current_case_status_desc_en: "Long English description.",
    current_case_status_text_es: "Aprobación De Caso Reafirmada",
    current_case_status_desc_es: "Descripción larga en español.",
    hist_case_status: null,
  },
  message: "Query was successful",
};

export const withHistoryBody = {
  case_status: {
    ...noHistoryBody.case_status,
    receiptNumber: "EAC9999103403",
    hist_case_status: [
      { date: "08-01-2023", completed_text_en: "Case Was Received", completed_text_es: "Caso Fue Recibido" },
    ],
  },
};

export const errorBody = { errors: [{ code: "INVALID_RECEIPT", message: "Receipt number is invalid" }] };
export const tokenBody = { access_token: "tok-1", token_type: "Bearer", expires_in: "1799" };
