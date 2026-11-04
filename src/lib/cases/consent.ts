import type { ConsentBasis } from "@prisma/client";

/**
 * Wording the user agrees to when adding a case. Stored by version on each
 * CaseConsent row; bump the version whenever the text changes.
 */
export const CONSENT_STATEMENT_VERSION = "2026-11-04";

export const INDIVIDUAL_CONSENT_OPTIONS: { basis: Extract<ConsentBasis, "SELF" | "AUTHORIZED_BY_APPLICANT">; label: string; statement: string }[] = [
  {
    basis: "SELF",
    label: "This is my own case",
    statement:
      "I am the applicant or petitioner on this case, and I ask ImmigrationCaseTracker to check its status with USCIS on my behalf.",
  },
  {
    basis: "AUTHORIZED_BY_APPLICANT",
    label: "I'm authorized by the applicant",
    statement:
      "The applicant or petitioner on this case has given me permission to track its status, and I ask ImmigrationCaseTracker to check it with USCIS on their behalf.",
  },
];

export const CONSENT_FOOTNOTE =
  "You can remove the case at any time, which stops all checks. Never add a receipt number you aren't authorized to track.";
