"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createChecklistService } from "@/lib/checklists-service";

/** Tick or untick one checklist item for the signed-in person (ignored when signed out). */
export async function toggleChecklistItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const key = String(formData.get("key") ?? "");
  const item = String(formData.get("item") ?? "");
  await createChecklistService({ db: prisma }).set(user.id, key, item, formData.get("done") === "1");
  refresh();
}
