-- USCIS's own error message for failed checks (USCIS demo requirement: the
-- API's error message is shown in the app). All columns are optional.

-- AlterTable
ALTER TABLE "TrackedCase" ADD COLUMN "lastCheckHttpStatus" INTEGER,
ADD COLUMN "lastCheckUscisMessage" TEXT;

-- AlterTable
ALTER TABLE "CaseCheckRun" ADD COLUMN "uscisErrorCode" TEXT,
ADD COLUMN "uscisErrorMessage" TEXT,
ADD COLUMN "uscisTraceId" TEXT;
