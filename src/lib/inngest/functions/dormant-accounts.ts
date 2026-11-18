import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { createDormantService } from "@/lib/auth/dormant";
import { performAccountDeletion } from "@/lib/auth/delete-account";
import { inngest } from "@/lib/inngest/client";
import { getSiteUrl } from "@/lib/supabase/env";

// Daily: the Privacy Policy's dormant-account rule. Warn personal accounts
// unused for 24 months; delete them 30 days later if nobody signed in.
export const dormantAccounts = inngest.createFunction(
  { id: "dormant-accounts", retries: 2, singleton: { mode: "skip" }, triggers: [{ cron: "23 9 * * *" }] },
  async ({ step }) =>
    step.run("dormant-accounts", () =>
      createDormantService({ db: prisma, mailer: getEmailDriver(), siteUrl: getSiteUrl(), deleteAccount: performAccountDeletion }).run(),
    ),
);
