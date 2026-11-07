-- Where each case's current status came from: the USCIS connection of its last successful check
-- ("mock", "sandbox" or "production"). Case insights only use statuses from the connection the site runs on,
-- so simulated or sandbox statuses never mix with real ones.
ALTER TABLE "TrackedCase" ADD COLUMN "statusSource" TEXT;

-- Existing cases: take it from the check log.
UPDATE "TrackedCase" AS c
SET "statusSource" = r."uscisEnv"
FROM (
  SELECT DISTINCT ON ("caseId") "caseId", "uscisEnv"
  FROM "CaseCheckRun"
  WHERE "outcome" = 'ok'
  ORDER BY "caseId", "attemptedAt" DESC
) AS r
WHERE r."caseId" = c."id";

CREATE INDEX "TrackedCase_statusSource_formType_idx" ON "TrackedCase"("statusSource", "formType");
