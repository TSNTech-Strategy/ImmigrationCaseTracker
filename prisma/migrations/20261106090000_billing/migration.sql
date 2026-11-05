-- Step 8: billing (Stripe). Additive only.

CREATE TYPE "FirmPlan" AS ENUM ('SOLO', 'FIRM');
CREATE TYPE "BillingProduct" AS ENUM ('PREMIUM', 'FIRM_SOLO', 'FIRM');

ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

ALTER TABLE "Firm" ADD COLUMN "plan" "FirmPlan";
ALTER TABLE "Firm" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Firm" ALTER COLUMN "caseLimit" SET DEFAULT 10;
CREATE UNIQUE INDEX "Firm_stripeCustomerId_key" ON "Firm"("stripeCustomerId");

ALTER TABLE "TrackedCase" ADD COLUMN "pausedReason" TEXT;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "userId" TEXT,
    "firmId" TEXT,
    "product" "BillingProduct" NOT NULL,
    "interval" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "pastDueSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX "Subscription_firmId_idx" ON "Subscription"("firmId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- At most one owner (both may become NULL if the account or firm is deleted; the row stays as a billing record).
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_one_owner" CHECK ("userId" IS NULL OR "firmId" IS NULL);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_interval" CHECK ("interval" IN ('month', 'year'));

CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- Same lock-down as every other table: no Supabase Data API access, RLS on.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "Subscription", "StripeEvent" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;
