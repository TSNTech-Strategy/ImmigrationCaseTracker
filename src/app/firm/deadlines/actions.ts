"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmAlertService } from "@/lib/firms";

export async function addDeadlineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const values = { kind: String(formData.get("kind") ?? ""), dueOn: String(formData.get("dueOn") ?? ""), note: String(formData.get("note") ?? "") };
  const r = await firmAlertService().addDeadline(user.id, String(formData.get("caseId") ?? ""), values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Deadline added. You'll get a reminder in Updates before it's due." };
}

/** Where to go back to after a deadline action: the case page or the firm's deadline list. */
function back(formData: FormData, notice: string) {
  const caseId = String(formData.get("caseId") ?? "");
  return formData.get("from") === "list" ? `/firm/deadlines?notice=${notice}` : `/firm/cases/${encodeURIComponent(caseId)}?notice=${notice}#deadlines-h`;
}

export async function setDeadlineDoneAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/firm/deadlines");
  const done = formData.get("done") === "1";
  const r = await firmAlertService().setDeadlineDone(user.id, String(formData.get("deadlineId") ?? ""), done);
  refresh(); // the workspace tabs (badges) re-read their counts
  redirect(back(formData, r.ok ? (done ? "deadline-done" : "deadline-reopened") : "deadline-error"));
}

export async function removeDeadlineAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/firm/deadlines");
  const r = await firmAlertService().removeDeadline(user.id, String(formData.get("deadlineId") ?? ""));
  refresh(); // the workspace tabs (badges) re-read their counts
  redirect(back(formData, r.ok ? "deadline-removed" : "deadline-error"));
}
