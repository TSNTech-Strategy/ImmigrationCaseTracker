-- Visa Bulletin: monthly charts imported by an admin, and the category each person follows. Additive only.
CREATE TABLE "VisaBulletin" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "charts" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT,
    CONSTRAINT "VisaBulletin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisaBulletin_month_key" ON "VisaBulletin"("month");
ALTER TABLE "VisaBulletin" ADD CONSTRAINT "VisaBulletin_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

CREATE TABLE "VisaBulletinWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "chart" TEXT NOT NULL DEFAULT 'final',
    "lastNotifiedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VisaBulletinWatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisaBulletinWatch_userId_key" ON "VisaBulletinWatch"("userId");
ALTER TABLE "VisaBulletinWatch" ADD CONSTRAINT "VisaBulletinWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisaBulletinWatch" ADD CONSTRAINT "VisaBulletinWatch_area" CHECK ("area" IN ('ALL', 'CHINA', 'INDIA', 'MEXICO', 'PHILIPPINES'));
ALTER TABLE "VisaBulletinWatch" ADD CONSTRAINT "VisaBulletinWatch_chart" CHECK ("chart" IN ('final', 'filing'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "VisaBulletin", "VisaBulletinWatch" FROM anon, authenticated';
  END IF;
END $$;
ALTER TABLE "VisaBulletin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisaBulletinWatch" ENABLE ROW LEVEL SECURITY;
