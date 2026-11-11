import { prisma } from "@/lib/db";
import { EVENTS, inngest } from "@/lib/inngest/client";
import { findDueCaseIds, tickSlot, uscisLooksDown } from "@/lib/jobs/scheduler";
import { sandboxClosedNow } from "@/lib/uscis/sandbox-hours";

// Every 15 minutes: find cases due for a check and queue one event each.
// The check function's throttle spaces the actual USCIS calls.
export const scheduleChecks = inngest.createFunction(
  {
    id: "schedule-case-checks",
    retries: 1,
    singleton: { mode: "skip" }, // never two ticks at once
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();
    const plan = await step.run("find-due-cases", async () => {
      // The USCIS test system only answers on weekdays, 7 AM to 8 PM Eastern: wait instead of
      // filling the night with failed checks. Due cases are picked up at the first tick after it opens.
      if (sandboxClosedNow(now)) return { paused: true, ids: [] as string[] };
      if (await uscisLooksDown(prisma, now)) return { paused: true, ids: [] as string[] };
      return { paused: false, ids: await findDueCaseIds(prisma, now) };
    });
    if (plan.paused || plan.ids.length === 0) return { dispatched: 0, paused: plan.paused };

    const slot = tickSlot(now);
    await step.sendEvent(
      "dispatch-checks",
      plan.ids.map((caseId) => ({ name: EVENTS.checkRequested, id: `check-${caseId}-${slot}`, data: { caseId } })),
    );
    return { dispatched: plan.ids.length, paused: false };
  },
);
