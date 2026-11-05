import type { ConsentBasis } from "@prisma/client";

/**
 * What a firm attests to when it adds a client's case. Stored by version on
 * each CaseConsent row (source FIRM_ATTESTATION) with the firm's own evidence
 * reference. We never store the documents themselves.
 */
export const FIRM_CONSENT_VERSION = "2026-11-05-firm";

export type FirmConsentBasis = Extract<ConsentBasis, "LEGAL_REPRESENTATIVE" | "AUTHORIZED_BY_APPLICANT">;

export const FIRM_CONSENT_OPTIONS: { basis: FirmConsentBasis; label: string; statement: string; evidenceHint: string }[] = [
  {
    basis: "LEGAL_REPRESENTATIVE",
    label: "We represent this client (Form G-28 on file)",
    statement:
      "Our firm is the attorney or accredited representative of record for the applicant or petitioner on this case (Form G-28 or equivalent on file), and we ask CasePingo to check its status with USCIS on the client's behalf.",
    evidenceHint: "e.g. G-28 signed 2026-10-01, matter 1234",
  },
  {
    basis: "AUTHORIZED_BY_APPLICANT",
    label: "The client gave us written consent",
    statement:
      "The applicant or petitioner on this case has given our firm written permission to track its status, we keep that consent on file, and we ask CasePingo to check it with USCIS on their behalf.",
    evidenceHint: "e.g. engagement letter dated 2026-10-01",
  },
];

export const firmConsentLabel = (basis: ConsentBasis) =>
  FIRM_CONSENT_OPTIONS.find((o) => o.basis === basis)?.label ?? "Consent recorded";
