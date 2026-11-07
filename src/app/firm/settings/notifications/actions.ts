"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmTeamService } from "@/lib/firms";

export async function savePreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const input = {
    inboxView: String(formData.get("inboxView") ?? ""),
    caseEmails: String(formData.get("caseEmails") ?? ""),
    caseEmailKinds: formData.getAll("caseEmailKinds").map(String),
    awayUntil: formData.get("away") === "on" ? String(formData.get("awayUntil") ?? "") : "",
    backupUserId: formData.get("away") === "on" ? String(formData.get("backupUserId") ?? "") : "",
  };
  const r = await firmTeamService().savePreferences(user.id, input);
  // stamp: the form remounts after every submit, so what's on screen always matches what was sent.
  const values = { ...input, caseEmailKinds: input.caseEmailKinds.join(","), away: formData.get("away") === "on" ? "on" : "", stamp: String(Date.now()) };
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Saved.", values };
}
