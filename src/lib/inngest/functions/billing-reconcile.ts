import { billingEnabled, billingService } from "@/lib/billing";
import { inngest } from "@/lib/inngest/client";

// Daily: end the 7-day grace period for unpaid subscriptions (Stripe sends no
// event at that moment, so we re-apply entitlements here).
export const billingReconcile = inngest.createFunction(
  { id: "billing-reconcile", retries: 2, singleton: { mode: "skip" }, triggers: [{ cron: "17 6 * * *" }] },
  async ({ step }) => {
    if (!billingEnabled()) return { skipped: "billing not configured" };
    return step.run("reconcile-past-due", () => billingService().reconcilePastDue());
  },
);
