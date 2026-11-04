import { Inngest } from "inngest";

// ImmigrationCaseTracker's OWN Inngest app — separate from Scanvio's
// ("scanvio-hub"). Production reads this project's INNGEST_EVENT_KEY and
// INNGEST_SIGNING_KEY; with neither set (local dev) the SDK talks to the
// local dev server (`npx inngest-cli@latest dev`).
export const inngest = new Inngest({ id: "immigration-case-tracker" });

/** "ict/case.check-requested": run one scheduled USCIS check. */
export interface CaseCheckRequestedData {
  caseId: string;
}

/** "ict/case.status-changed": a scheduled check observed a new status. */
export interface CaseStatusChangedData {
  eventId: string;
  caseId: string;
}

export const EVENTS = {
  checkRequested: "ict/case.check-requested",
  statusChanged: "ict/case.status-changed",
} as const;
