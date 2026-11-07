-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RequestItemStatus" AS ENUM ('PENDING', 'UPLOADED', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "FirmUpdateKind" ADD VALUE 'DOCUMENT';

-- AlterTable
ALTER TABLE "FirmDocument" ADD COLUMN     "requestItemId" TEXT;

-- AlterTable
ALTER TABLE "FirmUpdate" ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "caseId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "dueOn" DATE,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "linkVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEs" TEXT,
    "note" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "status" "RequestItemStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequest_firmId_status_createdAt_idx" ON "DocumentRequest"("firmId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequest_clientId_idx" ON "DocumentRequest"("clientId");

-- CreateIndex
CREATE INDEX "DocumentRequest_caseId_idx" ON "DocumentRequest"("caseId");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_requestId_position_idx" ON "DocumentRequestItem"("requestId", "position");

-- CreateIndex
CREATE INDEX "FirmUpdate_requestId_idx" ON "FirmUpdate"("requestId");

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "DocumentRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "FirmUpdate" DROP CONSTRAINT "FirmUpdate_kind_target_check";
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_kind_target_check" CHECK (
  ("kind"::text = 'STATUS_CHANGE' AND "eventId" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'STUCK' AND "alertKey" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'DEADLINE' AND "deadlineId" IS NOT NULL AND "alertKey" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'TASK' AND "taskId" IS NOT NULL AND "alertKey" IS NOT NULL)
  OR ("kind"::text = 'DOCUMENT' AND "requestId" IS NOT NULL AND "alertKey" IS NOT NULL)
);
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_text_check" CHECK (char_length("title") BETWEEN 2 AND 120 AND ("message" IS NULL OR char_length("message") <= 1000));
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_text_check" CHECK (char_length("label") BETWEEN 1 AND 160 AND ("note" IS NULL OR char_length("note") <= 300) AND ("rejectReason" IS NULL OR char_length("rejectReason") <= 300));

-- The app reaches the database only through the server; no direct client access.
ALTER TABLE "DocumentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRequestItem" ENABLE ROW LEVEL SECURITY;
