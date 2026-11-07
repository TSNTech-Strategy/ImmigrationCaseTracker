-- AlterEnum
ALTER TYPE "BillingProduct" ADD VALUE 'FIRM_PLUS';

-- AlterEnum
ALTER TYPE "FirmPlan" ADD VALUE 'PLUS';


-- New limits for firms already on a plan (Solo 50 -> 150 cases, Firm 300 -> 600).
UPDATE "Firm" SET "caseLimit" = 150 WHERE "plan" = 'SOLO' AND "caseLimit" < 150;
UPDATE "Firm" SET "caseLimit" = 600 WHERE "plan" = 'FIRM' AND "caseLimit" < 600;
