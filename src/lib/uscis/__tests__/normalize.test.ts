import { describe, expect, it } from "vitest";
import { normalizeCaseStatus, parseReportedDate } from "../normalize";
import { noHistoryBody, withHistoryBody } from "./fixtures";

describe("parseReportedDate", () => {
  it("parses USCIS MM-DD-YYYY HH:mm:ss without inventing a timezone", () => {
    expect(parseReportedDate("09-05-2023 14:28:46")).toEqual({ raw: "09-05-2023 14:28:46", local: "2023-09-05T14:28:46" });
  });
  it("accepts ISO-like dates", () => {
    expect(parseReportedDate("2023-09-05T14:28:46Z")?.local).toBe("2023-09-05T14:28:46");
  });
  it("keeps the raw value when the format is unknown or impossible", () => {
    expect(parseReportedDate("Sept 5")).toEqual({ raw: "Sept 5", local: null });
    expect(parseReportedDate("13-45-2023")).toEqual({ raw: "13-45-2023", local: null });
  });
  it("returns null for empty input", () => {
    expect(parseReportedDate(null)).toBeNull();
    expect(parseReportedDate("  ")).toBeNull();
  });
});

describe("normalizeCaseStatus", () => {
  it("normalizes the sample response", () => {
    const s = normalizeCaseStatus(noHistoryBody, "EAC9999103402");
    expect(s.formType).toBe("I-130");
    expect(s.status.es.title).toBe("Aprobación De Caso Reafirmada");
    expect(s.submittedDate?.local).toBe("2023-09-05T14:28:46");
    expect(s.history).toEqual([]);
    expect(s.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fingerprint is stable for identical data and changes when status changes", () => {
    const a = normalizeCaseStatus(noHistoryBody, "EAC9999103402");
    const b = normalizeCaseStatus(structuredClone(noHistoryBody), "EAC9999103402");
    expect(a.fingerprint).toBe(b.fingerprint);
    const changed = structuredClone(noHistoryBody);
    changed.case_status.current_case_status_text_en = "Case Was Approved";
    expect(normalizeCaseStatus(changed, "EAC9999103402").fingerprint).not.toBe(a.fingerprint);
    expect(normalizeCaseStatus(withHistoryBody, "EAC9999103403").fingerprint).not.toBe(a.fingerprint);
  });

  it("tolerates extra fields and missing optional ones", () => {
    const s = normalizeCaseStatus({ case_status: { receiptNumber: "EAC9999103402", newField: 1 } }, "EAC9999103402");
    expect(s.status.en.title).toBeNull();
    expect(s.hasHistory).toBe(false);
  });

  it("rejects a body without case_status", () => {
    expect(() => normalizeCaseStatus({ errors: [] }, "EAC9999103402")).toThrow();
  });
});
