import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { EVENTS, inngest, type CaseStatusChangedData } from "@/lib/inngest/client";
import { notifyStatusChange } from "@/lib/jobs/notifications";
import { getSiteUrl } from "@/lib/supabase/env";

// Email the owner about a status change. Idempotent per (event, person).
export const notifyStatusChangeFn = inngest.createFunction(
  {
    id: "notify-status-change",
    retries: 3,
    triggers: [{ event: EVENTS.statusChanged }],
  },
  async ({ event, step }) => {
    const { eventId } = event.data as CaseStatusChangedData;
    return step.run("send-email", () => notifyStatusChange(prisma, getEmailDriver(), eventId, getSiteUrl()));
  },
);
