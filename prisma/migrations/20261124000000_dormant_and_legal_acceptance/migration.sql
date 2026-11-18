-- Dormant-account clean-up (Privacy Policy: accounts unused for 24 months are
-- deleted after an email warning) and active consent to policy changes (users
-- accept the current Terms and Privacy Policy version). All columns optional.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "dormantNoticeAt" TIMESTAMP(3),
ADD COLUMN "legalAcceptedVersion" TEXT,
ADD COLUMN "legalAcceptedAt" TIMESTAMP(3);
