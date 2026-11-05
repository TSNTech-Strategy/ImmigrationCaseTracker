import { describe, expect, it } from "vitest";
import { statusChangeEmail } from "../templates";

const base = {
  to: "a@b.co",
  name: "Ana",
  caseLabel: "My I-130",
  receiptMasked: "EAC*******402",
  formType: "I-130",
  statusTitleEn: "Case Was Approved",
  statusTitleEs: "Caso Fue Aprobado",
  caseUrl: "https://x/cases/1",
  settingsUrl: "https://x/settings",
};

describe("status change email", () => {
  it("English", () => {
    const m = statusChangeEmail({ ...base, locale: "en" });
    expect(m.subject).toBe("Case update: Case Was Approved");
    expect(m.body).toMatch(/^Hi Ana,/);
    expect(m.body).toContain("not affiliated with USCIS");
    expect(m.body).toContain("https://x/settings");
  });
  it("Spanish", () => {
    const m = statusChangeEmail({ ...base, locale: "es" });
    expect(m.subject).toBe("Actualización de su caso: Caso Fue Aprobado");
    expect(m.body).toContain("Estado actual: Caso Fue Aprobado");
  });
  it("falls back when a translation is missing", () => {
    expect(statusChangeEmail({ ...base, locale: "es", statusTitleEs: null }).subject).toContain("Case Was Approved");
  });
});

import { firmInviteEmail } from "../templates";
describe("firm invite email", () => {
  it("names the firm, inviter, role and link", () => {
    const m = firmInviteEmail({
      to: "a@b.co",
      firmName: "Rivera Law",
      inviterName: "Ana",
      role: "ADMIN",
      acceptUrl: "https://casepingo.com/firm/invite/tok",
      expiresAt: new Date("2027-01-08T00:00:00Z"),
    });
    expect(m.subject).toBe("Ana invited you to Rivera Law on CasePingo");
    expect(m.body).toContain("as Admin");
    expect(m.body).toContain("https://casepingo.com/firm/invite/tok");
  });
});
