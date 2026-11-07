import { prisma } from "@/lib/db";
import { createFirmAlertService } from "@/lib/firms/alerts";
import { inngest } from "@/lib/inngest/client";

// Daily, early morning US Eastern: stuck-case alerts and deadline reminders in each firm's Updates inbox.
// Safe to run twice: each alert has a unique key.
export const firmAlerts = inngest.createFunction(
  { id: "firm-alerts", retries: 2, singleton: { mode: "skip" }, triggers: [{ cron: "TZ=America/New_York 41 5 * * *" }] },
  async ({ step }) => step.run("raise-alerts", () => createFirmAlertService({ db: prisma }).runDaily()),
);
