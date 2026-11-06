-- Daily assistant question counts (no content). Additive only.
CREATE TABLE "AssistantUsage" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("userId","day")
);
CREATE INDEX "AssistantUsage_day_idx" ON "AssistantUsage"("day");
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_count" CHECK ("count" >= 0);
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_day" CHECK ("day" ~ '^\d{4}-\d{2}-\d{2}$');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "AssistantUsage" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "AssistantUsage" ENABLE ROW LEVEL SECURITY;
