-- AlterTable
ALTER TABLE "FirmDocument" ADD COLUMN     "scannedWith" TEXT;


-- Only known scan methods.
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_scannedWith_check" CHECK ("scannedWith" IS NULL OR "scannedWith" IN ('basic', 'cloudmersive'));
