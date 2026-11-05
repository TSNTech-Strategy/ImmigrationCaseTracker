import { prisma } from "@/lib/db";
import { caseService } from "@/lib/cases";
import { EVENTS, inngest, type CaseCheckRequestedData } from "@/lib/inngest/client";
import { runScheduledCheck } from "@/lib/jobs/scheduler";

// One USCIS check per event. Throttled across the whole app to 3 calls per
// second, spaced evenly (burst 1): the sandbox's spike arrest allows 5/second
// with a burst of 1 — i.e. one call per 200 ms — and rejects bursts with 429.
export const checkCase = inngest.createFunction(
  {
    id: "check-case",
    retries: 2,
    throttle: { limit: 3, period: "1s", burst: 1 },
    concurrency: { limit: 5 },
    triggers: [{ event: EVENTS.checkRequested }],
  },
  async ({ event, step }) => {
    const { caseId } = event.data as CaseCheckRequestedData;
    const outcome = await step.run("check-with-uscis", () => runScheduledCheck(prisma, caseService(), caseId, new Date()));
    if (outcome.checked && outcome.changed && outcome.eventId) {
      await step.sendEvent("announce-change", {
        name: EVENTS.statusChanged,
        id: `changed-${outcome.eventId}`,
        data: { eventId: outcome.eventId, caseId },
      });
    }
    return outcome;
  },
);
