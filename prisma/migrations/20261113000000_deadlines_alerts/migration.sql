-- CreateEnum
CREATE TYPE "FirmUpdateKind" AS ENUM ('STATUS_CHANGE', 'STUCK', 'DEADLINE');

-- CreateEnum
CREATE TYPE "DeadlineKind" AS ENUM ('RFE_RESPONSE', 'NOID_RESPONSE', 'INTERVIEW', 'BIOMETRICS', 'FILING', 'OTHER');

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "deadlineLeadDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "stuckAfterDays" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "FirmUpdate" ADD COLUMN     "alertKey" TEXT,
ADD COLUMN     "deadlineId" TEXT,
ADD COLUMN     "kind" "FirmUpdateKind" NOT NULL DEFAULT 'STATUS_CHANGE',
ADD COLUMN     "stuckDays" INTEGER,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CaseDeadline" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "DeadlineKind" NOT NULL,
    "dueOn" DATE NOT NULL,
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseDeadline_firmId_doneAt_dueOn_idx" ON "CaseDeadline"("firmId", "doneAt", "dueOn");

-- CreateIndex
CREATE INDEX "CaseDeadline_caseId_idx" ON "CaseDeadline"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmUpdate_alertKey_key" ON "FirmUpdate"("alertKey");

-- CreateIndex
CREATE INDEX "FirmUpdate_deadlineId_idx" ON "FirmUpdate"("deadlineId");

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "CaseDeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_caseId_firmId_fkey" FOREIGN KEY ("caseId", "firmId") REFERENCES "TrackedCase"("id", "firmId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Each kind of update points at what it is about.
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_kind_target_check" CHECK (
  ("kind" = 'STATUS_CHANGE' AND "eventId" IS NOT NULL)
  OR ("kind" = 'STUCK' AND "alertKey" IS NOT NULL)
  OR ("kind" = 'DEADLINE' AND "deadlineId" IS NOT NULL AND "alertKey" IS NOT NULL)
);
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_stuckAfterDays_check" CHECK ("stuckAfterDays" BETWEEN 0 AND 730);
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_deadlineLeadDays_check" CHECK ("deadlineLeadDays" BETWEEN 1 AND 60);
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_note_check" CHECK ("note" IS NULL OR char_length("note") <= 120);

-- The app reaches the database only through the server; no direct client access.
ALTER TABLE "CaseDeadline" ENABLE ROW LEVEL SECURITY;
