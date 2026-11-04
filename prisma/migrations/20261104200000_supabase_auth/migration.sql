-- Supabase Auth now owns passwords, email verification and sessions.
-- "User".id is the Supabase auth user id (auth.users.id) from here on.

-- Remove the demo rows created by the earlier seed: their ids predate Supabase
-- Auth and can never sign in. Re-run `npm run db:seed` to recreate them as
-- real Supabase Auth users. (Only these demo records are touched.)
DELETE FROM "Firm" WHERE "name" = 'Demo Immigration Law'
  AND NOT EXISTS (
    SELECT 1 FROM "FirmMembership" m JOIN "User" u ON u.id = m."userId"
    WHERE m."firmId" = "Firm".id AND u.email NOT IN ('demo@ict.dev', 'firm@ict.dev')
  );
DELETE FROM "User" WHERE "email" IN ('demo@ict.dev', 'firm@ict.dev');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerifiedAt",
DROP COLUMN "passwordChangedAt",
DROP COLUMN "passwordHash";
