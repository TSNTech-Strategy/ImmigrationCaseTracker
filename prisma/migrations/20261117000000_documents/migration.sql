-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('USCIS_NOTICE', 'IDENTITY', 'CIVIL', 'FINANCIAL', 'EVIDENCE', 'FORM', 'CORRESPONDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('FIRM', 'CLIENT');

-- CreateTable
CREATE TABLE "FirmDocument" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "caseId" TEXT,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "source" "DocumentSource" NOT NULL DEFAULT 'FIRM',
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmDocument_storageKey_key" ON "FirmDocument"("storageKey");

-- CreateIndex
CREATE INDEX "FirmDocument_firmId_createdAt_idx" ON "FirmDocument"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "FirmDocument_caseId_idx" ON "FirmDocument"("caseId");

-- CreateIndex
CREATE INDEX "FirmDocument_clientId_idx" ON "FirmDocument"("clientId");

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TrackedCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_check" CHECK (char_length("name") BETWEEN 1 AND 200 AND "size" > 0 AND "size" <= 26214400 AND "sha256" ~ '^[0-9a-f]{64}$');

-- The app reaches the database only through the server; no direct client access.
ALTER TABLE "FirmDocument" ENABLE ROW LEVEL SECURITY;
