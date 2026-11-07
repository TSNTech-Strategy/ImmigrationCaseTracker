-- CreateEnum
CREATE TYPE "ClientUpdateMode" AS ENUM ('OFF', 'REVIEW', 'AUTO');

-- CreateEnum
CREATE TYPE "FirmUpdateState" AS ENUM ('OPEN', 'SNOOZED', 'DONE');

-- CreateEnum
CREATE TYPE "ClientUpdateState" AS ENUM ('NONE', 'NO_CLIENT', 'PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portalVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updatesConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "clientContactLine" TEXT,
ADD COLUMN     "clientUpdates" "ClientUpdateMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "replyToEmail" TEXT;

-- CreateTable
CREATE TABLE "FirmUpdate" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "state" "FirmUpdateState" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "clientUpdate" "ClientUpdateState" NOT NULL DEFAULT 'NONE',
    "clientUpdateAt" TIMESTAMP(3),
    "clientUpdateById" TEXT,
    "clientUpdateError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmUpdate_eventId_key" ON "FirmUpdate"("eventId");

-- CreateIndex
CREATE INDEX "FirmUpdate_firmId_state_createdAt_idx" ON "FirmUpdate"("firmId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "FirmUpdate_caseId_idx" ON "FirmUpdate"("caseId");

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_caseId_firmId_fkey" FOREIGN KEY ("caseId", "firmId") REFERENCES "TrackedCase"("id", "firmId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CaseStatusEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmUpdate" ADD CONSTRAINT "FirmUpdate_clientUpdateById_fkey" FOREIGN KEY ("clientUpdateById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Client languages the app speaks.
ALTER TABLE "Client" ADD CONSTRAINT "Client_locale_check" CHECK ("locale" IN ('en', 'es'));

-- Row-level security on every table (the app connects as the table owner; Supabase's public API gets nothing).
ALTER TABLE "FirmUpdate" ENABLE ROW LEVEL SECURITY;
