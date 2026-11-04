-- CreateEnum
CREATE TYPE "FirmStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CheckTrigger" AS ENUM ('INITIAL', 'MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ConsentBasis" AS ENUM ('SELF', 'AUTHORIZED_BY_APPLICANT', 'LEGAL_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('WEB', 'MOBILE', 'FIRM_ATTESTATION', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeletionScope" AS ENUM ('ACCOUNT', 'CASE', 'FIRM');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "emailOnChange" BOOLEAN NOT NULL DEFAULT true,
    "pushOnChange" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FirmStatus" NOT NULL DEFAULT 'ACTIVE',
    "caseLimit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FirmRole" NOT NULL DEFAULT 'STAFF',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmInvitation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FirmRole" NOT NULL DEFAULT 'STAFF',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "externalRef" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedCase" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "firmId" TEXT,
    "clientId" TEXT,
    "addedById" TEXT,
    "receiptEncrypted" TEXT NOT NULL,
    "receiptDigest" TEXT NOT NULL,
    "receiptMasked" TEXT NOT NULL,
    "nickname" TEXT,
    "trackingStatus" "TrackingStatus" NOT NULL DEFAULT 'ACTIVE',
    "formType" TEXT,
    "statusTitleEn" TEXT,
    "statusTitleEs" TEXT,
    "statusDescriptionEn" TEXT,
    "statusDescriptionEs" TEXT,
    "uscisSubmittedRaw" TEXT,
    "uscisModifiedRaw" TEXT,
    "uscisHistory" JSONB,
    "statusFingerprint" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckOutcome" TEXT,
    "lastChangeObservedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseConsent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "basis" "ConsentBasis" NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "statementVersion" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "grantedById" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,

    CONSTRAINT "CaseConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStatusEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "formType" TEXT,
    "statusTitleEn" TEXT,
    "statusTitleEs" TEXT,
    "statusDescriptionEn" TEXT,
    "statusDescriptionEs" TEXT,
    "uscisReportedRaw" TEXT,
    "fingerprint" TEXT NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCheckRun" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "trigger" "CheckTrigger" NOT NULL,
    "uscisEnv" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "firmId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT,
    "requesterEmail" TEXT NOT NULL,
    "firmId" TEXT,
    "scope" "DeletionScope" NOT NULL,
    "targetId" TEXT,
    "status" "DeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FirmMembership_userId_idx" ON "FirmMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMembership_firmId_userId_key" ON "FirmMembership"("firmId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmInvitation_tokenHash_key" ON "FirmInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FirmInvitation_firmId_idx" ON "FirmInvitation"("firmId");

-- CreateIndex
CREATE INDEX "Client_firmId_idx" ON "Client"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_id_firmId_key" ON "Client"("id", "firmId");

-- CreateIndex
CREATE INDEX "TrackedCase_trackingStatus_nextCheckAt_idx" ON "TrackedCase"("trackingStatus", "nextCheckAt");

-- CreateIndex
CREATE INDEX "TrackedCase_clientId_idx" ON "TrackedCase"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedCase_ownerUserId_receiptDigest_key" ON "TrackedCase"("ownerUserId", "receiptDigest");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedCase_firmId_receiptDigest_key" ON "TrackedCase"("firmId", "receiptDigest");

-- CreateIndex
CREATE INDEX "CaseConsent_caseId_withdrawnAt_idx" ON "CaseConsent"("caseId", "withdrawnAt");

-- CreateIndex
CREATE INDEX "CaseStatusEvent_caseId_firstObservedAt_idx" ON "CaseStatusEvent"("caseId", "firstObservedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStatusEvent_caseId_fingerprint_key" ON "CaseStatusEvent"("caseId", "fingerprint");

-- CreateIndex
CREATE INDEX "CaseCheckRun_caseId_attemptedAt_idx" ON "CaseCheckRun"("caseId", "attemptedAt");

-- CreateIndex
CREATE INDEX "CaseCheckRun_attemptedAt_idx" ON "CaseCheckRun"("attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_firmId_createdAt_idx" ON "AuditLog"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "DeletionRequest_status_requestedAt_idx" ON "DeletionRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_clientId_firmId_fkey" FOREIGN KEY ("clientId", "firmId") REFERENCES "Client"("id", "firmId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseConsent" ADD CONSTRAINT "CaseConsent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseConsent" ADD CONSTRAINT "CaseConsent_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseConsent" ADD CONSTRAINT "CaseConsent_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStatusEvent" ADD CONSTRAINT "CaseStatusEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCheckRun" ADD CONSTRAINT "CaseCheckRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CaseStatusEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints Prisma can't express
-- ---------------------------------------------------------------------------

-- A case belongs to exactly one owner: an individual user XOR a firm.
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_exactly_one_owner"
  CHECK (("ownerUserId" IS NULL) <> ("firmId" IS NULL));

-- Only firm cases can have a client.
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_client_requires_firm"
  CHECK ("clientId" IS NULL OR "firmId" IS NOT NULL);

-- Locale is one of the supported languages.
ALTER TABLE "User" ADD CONSTRAINT "User_locale_supported" CHECK ("locale" IN ('en', 'es'));

-- Emails are compared case-insensitively; store them lowercased.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));

-- Lock the Supabase Data API out of every table: the app reaches the database
-- only through Prisma on the server. On plain Postgres these roles don't exist
-- and this block does nothing. Runs again for future tables via the default
-- privileges below.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  END IF;
END $$;

-- Row Level Security on, with no policies: even if a grant slips back in,
-- the anon/authenticated API roles see nothing. The table owner (the role
-- Prisma connects as) is not subject to RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User', 'NotificationPreference', 'Firm', 'FirmMembership', 'FirmInvitation',
    'Client', 'TrackedCase', 'CaseConsent', 'CaseStatusEvent', 'CaseCheckRun',
    'NotificationDelivery', 'AuditLog', 'DeletionRequest'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
