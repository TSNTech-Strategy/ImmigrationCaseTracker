-- Firm tags: labels a firm's team shares on the firm's cases. Additive only.
CREATE TABLE "FirmTag" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirmTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FirmTag_firmId_nameKey_key" ON "FirmTag"("firmId", "nameKey");
CREATE UNIQUE INDEX "FirmTag_id_firmId_key" ON "FirmTag"("id", "firmId");
ALTER TABLE "FirmTag" ADD CONSTRAINT "FirmTag_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirmTag" ADD CONSTRAINT "FirmTag_name" CHECK (char_length("name") BETWEEN 1 AND 32 AND char_length("nameKey") BETWEEN 1 AND 32);
ALTER TABLE "FirmTag" ADD CONSTRAINT "FirmTag_color" CHECK ("color" IN ('blue', 'green', 'amber', 'red', 'purple', 'gray'));

-- Lets a firm tag link require the case's firm. (id is already unique, so this only adds the pairing.)
CREATE UNIQUE INDEX "TrackedCase_id_firmId_key" ON "TrackedCase"("id", "firmId");

CREATE TABLE "FirmCaseTag" (
    "caseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirmCaseTag_pkey" PRIMARY KEY ("caseId", "tagId")
);
CREATE INDEX "FirmCaseTag_tagId_idx" ON "FirmCaseTag"("tagId");
-- Both keys include the firm: only a firm's own tag on its own case (personal cases have no firm, so they can't get firm tags).
ALTER TABLE "FirmCaseTag" ADD CONSTRAINT "FirmCaseTag_caseId_firmId_fkey" FOREIGN KEY ("caseId", "firmId") REFERENCES "TrackedCase"("id", "firmId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirmCaseTag" ADD CONSTRAINT "FirmCaseTag_tagId_firmId_fkey" FOREIGN KEY ("tagId", "firmId") REFERENCES "FirmTag"("id", "firmId") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "FirmTag", "FirmCaseTag" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "FirmTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FirmCaseTag" ENABLE ROW LEVEL SECURITY;
