-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "aNumberEnc" TEXT,
ADD COLUMN     "aNumberLast4" TEXT,
ADD COLUMN     "citizenship" TEXT,
ADD COLUMN     "countryOfBirth" TEXT,
ADD COLUMN     "dateOfBirthEnc" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "defaultAssigneeId" TEXT,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/New_York';

-- AlterTable
ALTER TABLE "TrackedCase" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "TrackedCase_firmId_assigneeId_idx" ON "TrackedCase"("firmId", "assigneeId");

-- AddForeignKey
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Two-letter country codes, a valid IANA-style time zone name, and only the last four A-Number digits in the clear.
ALTER TABLE "Client" ADD CONSTRAINT "Client_country_check" CHECK (("countryOfBirth" IS NULL OR "countryOfBirth" ~ '^[A-Z]{2}$') AND ("citizenship" IS NULL OR "citizenship" ~ '^[A-Z]{2}$'));
ALTER TABLE "Client" ADD CONSTRAINT "Client_aNumberLast4_check" CHECK ("aNumberLast4" IS NULL OR "aNumberLast4" ~ '^[0-9]{4}$');
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_timeZone_check" CHECK ("timeZone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$' AND char_length("timeZone") <= 64);

-- Existing firm cases belong to whoever added them, until the firm reassigns them.
UPDATE "TrackedCase" SET "assigneeId" = "addedById" WHERE "firmId" IS NOT NULL AND "assigneeId" IS NULL AND "addedById" IS NOT NULL;
