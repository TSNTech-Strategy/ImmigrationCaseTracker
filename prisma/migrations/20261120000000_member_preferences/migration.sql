-- AlterTable
ALTER TABLE "FirmMembership" ADD COLUMN     "awayUntil" DATE,
ADD COLUMN     "backupUserId" TEXT,
ADD COLUMN     "caseEmailKinds" TEXT[] DEFAULT ARRAY['action', 'done', 'stop']::TEXT[],
ADD COLUMN     "caseEmails" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "inboxView" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;


-- Only known values.
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_title_check" CHECK ("title" IS NULL OR "title" IN ('ATTORNEY', 'PARALEGAL', 'LEGAL_ASSISTANT', 'OTHER'));
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_inboxView_check" CHECK ("inboxView" IN ('mine', 'all'));
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_caseEmails_check" CHECK ("caseEmails" IN ('none', 'mine', 'all'));
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_caseEmailKinds_check" CHECK ("caseEmailKinds" <@ ARRAY['action', 'done', 'stop', 'progress']::TEXT[]);
-- A backup is someone else, and only matters with an away date.
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_backup_check" CHECK ("backupUserId" IS NULL OR "backupUserId" <> "userId");
