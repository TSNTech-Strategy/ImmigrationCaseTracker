-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "logoContentType" TEXT,
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoVersion" INTEGER NOT NULL DEFAULT 0;


-- Only image logos, and a version that never goes below zero.
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_logo_check" CHECK (
  ("logoKey" IS NULL AND "logoContentType" IS NULL)
  OR ("logoKey" IS NOT NULL AND "logoContentType" IN ('image/png', 'image/jpeg', 'image/webp'))
);
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_logoVersion_check" CHECK ("logoVersion" >= 0);
