import "server-only";
import { prisma } from "@/lib/db";
import { getEmailDriver } from "@/lib/email";
import { getSiteUrl } from "@/lib/supabase/env";
import { createBillingService } from "./service";
import { automaticTaxEnabled, getStripe } from "./stripe";

/** The billing service wired to the real database, Stripe and email. Only call when billingEnabled(). */
export function billingService() {
  return createBillingService({
    db: prisma,
    stripe: getStripe(),
    mailer: getEmailDriver(),
    siteUrl: getSiteUrl(),
    automaticTax: automaticTaxEnabled(),
  });
}

export { billingEnabled, billingTestMode } from "./stripe";
