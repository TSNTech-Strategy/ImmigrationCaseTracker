-- Document checklists: the items each person has ticked as gathered (item keys only, never documents).
CREATE TABLE "ChecklistCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checklist" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistCheck_userId_checklist_item_key" ON "ChecklistCheck"("userId", "checklist", "item");
CREATE INDEX "ChecklistCheck_userId_checklist_idx" ON "ChecklistCheck"("userId", "checklist");

ALTER TABLE "ChecklistCheck" ADD CONSTRAINT "ChecklistCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Like every table: no access through Supabase's public API (the server connects directly).
ALTER TABLE "ChecklistCheck" ENABLE ROW LEVEL SECURITY;
