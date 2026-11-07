-- Case tags: labels people put on their own cases to group and filter them. Additive only.
CREATE TABLE "CaseTag" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CaseTag_ownerUserId_nameKey_key" ON "CaseTag"("ownerUserId", "nameKey");
CREATE UNIQUE INDEX "CaseTag_id_ownerUserId_key" ON "CaseTag"("id", "ownerUserId");
ALTER TABLE "CaseTag" ADD CONSTRAINT "CaseTag_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseTag" ADD CONSTRAINT "CaseTag_name" CHECK (char_length("name") BETWEEN 1 AND 24 AND char_length("nameKey") BETWEEN 1 AND 24);
ALTER TABLE "CaseTag" ADD CONSTRAINT "CaseTag_color" CHECK ("color" IN ('blue', 'green', 'amber', 'red', 'purple', 'gray'));

-- Lets a tag link require the case's owner. (id is already unique, so this only adds the pairing.)
CREATE UNIQUE INDEX "TrackedCase_id_ownerUserId_key" ON "TrackedCase"("id", "ownerUserId");

CREATE TABLE "TrackedCaseTag" (
    "caseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackedCaseTag_pkey" PRIMARY KEY ("caseId", "tagId")
);
CREATE INDEX "TrackedCaseTag_tagId_idx" ON "TrackedCaseTag"("tagId");
-- Both keys include the owner: only a person's own tag on their own case (firm cases have no owner, so they can't be tagged).
ALTER TABLE "TrackedCaseTag" ADD CONSTRAINT "TrackedCaseTag_caseId_ownerUserId_fkey" FOREIGN KEY ("caseId", "ownerUserId") REFERENCES "TrackedCase"("id", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackedCaseTag" ADD CONSTRAINT "TrackedCaseTag_tagId_ownerUserId_fkey" FOREIGN KEY ("tagId", "ownerUserId") REFERENCES "CaseTag"("id", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "CaseTag", "TrackedCaseTag" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "CaseTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackedCaseTag" ENABLE ROW LEVEL SECURITY;
