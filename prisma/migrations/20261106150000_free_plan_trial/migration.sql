-- Free plan limits and the new-account Premium trial. Additive only.
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "trialNoticeStage" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TrialLedger" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialLedger_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "TrialLedger_createdAt_idx" ON "TrialLedger"("createdAt");
ALTER TABLE "TrialLedger" ADD CONSTRAINT "TrialLedger_kind" CHECK ("kind" IN ('email', 'receipt'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "TrialLedger" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "TrialLedger" ENABLE ROW LEVEL SECURITY;
