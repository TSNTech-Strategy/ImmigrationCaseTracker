import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { billingEnabled, billingService } from "@/lib/billing";
import { createTrialService } from "@/lib/billing/trial";
import { inngest } from "@/lib/inngest/client";
import { getSiteUrl } from "@/lib/supabase/env";

// Hourly: Premium trials (reminder, end, fingerprint clean-up) and the end of
// the 7-day grace for unpaid subscriptions. Neither has a Stripe event at the
// right moment, so we re-apply entitlements here.
export const billingReconcile = inngest.createFunction(
  { id: "billing-reconcile", retries: 2, singleton: { mode: "skip" }, triggers: [{ cron: "17 * * * *" }] },
  async ({ step }) => {
    const trials = await step.run("trials", () =>
      createTrialService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl() }).runTrialJobs(),
    );
    const pastDue = billingEnabled() ? await step.run("reconcile-past-due", () => billingService().reconcilePastDue()) : { skipped: "billing not configured" };
    return { trials, pastDue };
  },
);
