import { prisma } from "@/lib/db";
import { createFirmAlertService } from "@/lib/firms/alerts";
import { createFirmTaskService } from "@/lib/firms/tasks";
import { firmChecksAllowedWhere } from "@/lib/billing/entitlements";
import { inngest } from "@/lib/inngest/client";

// Daily, early morning US Eastern: stuck-case alerts, deadline reminders and task due reminders in each firm's Inbox.
// Safe to run twice: each alert has a unique key.
export const firmAlerts = inngest.createFunction(
  { id: "firm-alerts", retries: 2, singleton: { mode: "skip" }, triggers: [{ cron: "TZ=America/New_York 41 5 * * *" }] },
  async ({ step }) => {
    const alerts = await step.run("raise-alerts", () => createFirmAlertService({ db: prisma }).runDaily());
    const tasks = await step.run("task-reminders", async () => {
      const svc = createFirmTaskService({ db: prisma });
      const firms = await prisma.firm.findMany({ where: firmChecksAllowedWhere(new Date()), select: { id: true, timeZone: true } });
      let n = 0;
      for (const f of firms) n += await svc.raiseDue(f);
      return { firms: firms.length, reminders: n };
    });
    return { alerts, tasks };
  },
);
