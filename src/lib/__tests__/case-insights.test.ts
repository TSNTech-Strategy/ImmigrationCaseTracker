import { describe, expect, it } from "vitest";
import { CELEBRATION_WINDOW_DAYS, STAGE_COUNT, approvalNextStep, caseStage, formInfo, observedApprovalAt, receivingOffice, recentApprovalAt } from "../case-insights";

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12));
const ev = (title: string, n: number) => ({ statusTitleEn: title, firstObservedAt: day(n) });

describe("receivingOffice", () => {
  it("reads the office from the receipt prefix", () => {
    expect(receivingOffice("EAC*******402")?.name?.en).toBe("Vermont Service Center");
    expect(receivingOffice("lin*******001")?.name?.es).toBe("Centro de Servicio de Nebraska");
    expect(receivingOffice("IOE*******123")?.name?.en).toContain("ELIS");
    expect(receivingOffice("NYC*******123")).toEqual({ code: "NYC", name: null });
    expect(receivingOffice("")).toBeNull();
    expect(receivingOffice(null)).toBeNull();
  });
});

describe("formInfo", () => {
  it("normalizes the form code and names common forms", () => {
    expect(formInfo("I130")).toEqual({ code: "I-130", name: expect.objectContaining({ en: "Petition for Alien Relative" }) });
    expect(formInfo("i-821d")?.code).toBe("I-821D");
    expect(formInfo("N-400")?.name?.es).toBe("Solicitud de Naturalización");
    expect(formInfo("I-999")).toEqual({ code: "I-999", name: null });
    expect(formInfo("Some Form")).toEqual({ code: "Some Form", name: null });
    expect(formInfo(null)).toBeNull();
  });
});

describe("observedApprovalAt", () => {
  it("is the first approved status we saw after a pending one", () => {
    const events = [ev("Card Was Mailed To Me", 9), ev("Case Was Received", 1), ev("Case Was Approved", 5)];
    expect(observedApprovalAt("Card Was Mailed To Me", events)).toEqual(day(5));
  });

  it("ignores cases that were already approved when added", () => {
    expect(observedApprovalAt("Case Was Approved", [ev("Case Was Approved", 3)])).toBeNull();
    expect(observedApprovalAt("Card Was Mailed To Me", [ev("Case Was Approved", 3), ev("Card Was Mailed To Me", 6)])).toBeNull();
  });

  it("needs the current status to be approved", () => {
    expect(observedApprovalAt("Case Was Denied", [ev("Case Was Received", 1), ev("Case Was Approved", 2), ev("Case Was Denied", 3)])).toBeNull();
    expect(observedApprovalAt(null, [])).toBeNull();
  });
});

describe("recentApprovalAt", () => {
  const events = [ev("Case Was Received", 1), ev("Case Was Approved", 2)];
  it(`celebrates for ${CELEBRATION_WINDOW_DAYS} days`, () => {
    expect(recentApprovalAt("Case Was Approved", events, new Date(day(2).getTime() + 29 * 86_400_000))).toEqual(day(2));
    expect(recentApprovalAt("Case Was Approved", events, new Date(day(2).getTime() + 31 * 86_400_000))).toBeNull();
  });
});

describe("approvalNextStep", () => {
  it("depends on the form right after approval", () => {
    expect(approvalNextStep("I-485", "Case Was Approved")?.en).toContain("produces your card");
    expect(approvalNextStep("N400", "Case Was Approved")?.es).toContain("juramentación");
    expect(approvalNextStep("I-130", "Case Was Approved And My Decision Was Emailed")?.en).toContain("National Visa Center");
  });
  it("uses the current status once the case has moved on", () => {
    expect(approvalNextStep("I-485", "Card Was Mailed To Me")?.en).toContain("Postal Service");
    expect(approvalNextStep("I-999", "Case Was Approved")?.en).toContain("approval notice");
    expect(approvalNextStep(null, null)).toBeNull();
  });
});

describe("caseStage", () => {
  it("places each status on the four-step line", () => {
    expect(caseStage("Case Was Received")).toBe(0);
    expect(caseStage("Request for Additional Evidence Was Sent")).toBe(1);
    expect(caseStage("Case Was Transferred And A New Office Has Jurisdiction")).toBe(1);
    expect(caseStage("Case Was Approved")).toBe(2);
    expect(caseStage("Case Was Denied")).toBe(2);
    expect(caseStage("Card Was Delivered To Me By The Post Office")).toBe(3);
    expect(caseStage("Oath Ceremony Was Scheduled")).toBe(3);
    expect(caseStage("Some New USCIS Wording")).toBe(1);
    expect(caseStage(null)).toBeNull();
  });
  it("covers every guide entry", async () => {
    const { STATUS_GUIDE } = await import("../status-guide");
    for (const g of STATUS_GUIDE) expect(caseStage(g.title), g.slug).toBeGreaterThanOrEqual(0);
    expect(STAGE_COUNT).toBe(4);
  });
});
