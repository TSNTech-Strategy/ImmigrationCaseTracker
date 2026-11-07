-- CreateEnum
CREATE TYPE "FirmTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'WAITING', 'DONE');

-- CreateEnum
CREATE TYPE "FirmTaskType" AS ENUM ('GENERAL', 'CLIENT_FOLLOW_UP', 'FORM_PREP', 'FILING', 'RESPONSE', 'REVIEW');

-- CreateEnum
CREATE TYPE "FirmTaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
ALTER TYPE "FirmUpdateKind" ADD VALUE 'TASK';

-- AlterTable
ALTER TABLE "FirmUpdate" ADD COLUMN     "taskId" TEXT,
ALTER COLUMN "caseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FirmTask" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FirmTaskStatus" NOT NULL DEFAULT 'TODO',
    "type" "FirmTaskType" NOT NULL DEFAULT 'GENERAL',
    "priority" "FirmTaskPriority" NOT NULL DEFAULT 'NONE',
    "dueOn" DATE,
    "assigneeId" TEXT,
    "caseId" TEXT,
    "clientId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmTask_firmId_status_dueOn_idx" ON "FirmTask"("firmId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "FirmTask_firmId_assigneeId_status_idx" ON "FirmTask"("firmId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "FirmTask_caseId_idx" ON "FirmTask"("caseId");

-- CreateIndex
CREATE INDEX "FirmTask_clientId_idx" ON "FirmTask"("clientId");

-- CreateIndex
CREATE INDEX "FirmTaskComment_taskId_createdAt_idx" ON "FirmTaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "FirmUpdate_taskId_idx" ON "FirmUpdate"("taskId");

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FirmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTaskComment" ADD CONSTRAINT "FirmTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FirmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTaskComment" ADD CONSTRAINT "FirmTaskComment_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTaskComment" ADD CONSTRAINT "FirmTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Each kind of update points at what it is about ("kind"::text: the new enum value can't be used directly in this transaction).
ALTER TABLE "FirmUpdate" DROP CONSTRAINT "FirmUpdate_kind_target_check";
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_kind_target_check" CHECK (
  ("kind"::text = 'STATUS_CHANGE' AND "eventId" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'STUCK' AND "alertKey" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'DEADLINE' AND "deadlineId" IS NOT NULL AND "alertKey" IS NOT NULL AND "caseId" IS NOT NULL)
  OR ("kind"::text = 'TASK' AND "taskId" IS NOT NULL AND "alertKey" IS NOT NULL)
);
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_text_check" CHECK (char_length("title") BETWEEN 1 AND 140 AND ("description" IS NULL OR char_length("description") <= 4000));
ALTER TABLE "FirmTaskComment" ADD CONSTRAINT "FirmTaskComment_body_check" CHECK (char_length("body") BETWEEN 1 AND 4000);

-- The app reaches the database only through the server; no direct client access.
ALTER TABLE "FirmTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FirmTaskComment" ENABLE ROW LEVEL SECURITY;
