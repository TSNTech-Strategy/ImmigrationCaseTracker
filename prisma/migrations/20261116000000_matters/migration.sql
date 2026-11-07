-- CreateEnum
CREATE TYPE "MatterKind" AS ENUM ('FAMILY', 'EMPLOYER', 'LAWSUIT', 'CUSTOM');

-- AlterTable
ALTER TABLE "FirmTask" ADD COLUMN     "matterId" TEXT;

-- AlterTable
ALTER TABLE "TrackedCase" ADD COLUMN     "matterId" TEXT;

-- CreateTable
CREATE TABLE "FirmMatter" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "kind" "MatterKind" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMatter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmMatter_firmId_archivedAt_idx" ON "FirmMatter"("firmId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMatter_firmId_nameKey_key" ON "FirmMatter"("firmId", "nameKey");

-- CreateIndex
CREATE INDEX "FirmTask_matterId_idx" ON "FirmTask"("matterId");

-- CreateIndex
CREATE INDEX "TrackedCase_matterId_idx" ON "TrackedCase"("matterId");

-- AddForeignKey
ALTER TABLE "TrackedCase" ADD CONSTRAINT "TrackedCase_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmTask" ADD CONSTRAINT "FirmTask_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "FirmMatter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMatter" ADD CONSTRAINT "FirmMatter_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMatter" ADD CONSTRAINT "FirmMatter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "FirmMatter" ADD CONSTRAINT "FirmMatter_text_check" CHECK (char_length("name") BETWEEN 2 AND 80 AND "nameKey" = lower("name") AND ("description" IS NULL OR char_length("description") <= 500));

-- The app reaches the database only through the server; no direct client access.
ALTER TABLE "FirmMatter" ENABLE ROW LEVEL SECURITY;
