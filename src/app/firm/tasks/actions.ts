"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmTaskService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };

function readTask(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    title: get("title"),
    description: get("description"),
    status: get("status"),
    type: get("type"),
    priority: get("priority"),
    dueOn: get("dueOn"),
    assigneeId: get("assigneeId"),
    caseId: get("caseId"),
    clientId: get("clientId"),
  };
}

const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? "");
  return s.startsWith("/firm/") && !s.startsWith("//") ? s : fallback;
};

export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readTask(formData);
  const r = await firmTaskService().create(user.id, values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  redirect(`/firm/tasks/${r.id}?notice=created`);
}

export async function updateTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readTask(formData);
  const r = await firmTaskService().update(user.id, String(formData.get("taskId") ?? ""), values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Task saved.", values };
}

/** The checkbox in task lists: done / not done, then back to the same list. */
export async function toggleTaskDoneAction(formData: FormData) {
  const user = await getCurrentUser();
  const back = safeBack(formData.get("back"), "/firm/tasks");
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  await firmTaskService().setDone(user.id, String(formData.get("taskId") ?? ""), formData.get("done") === "1");
  refresh();
  redirect(back);
}

export async function deleteTaskAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/firm/tasks");
  const r = await firmTaskService().remove(user.id, String(formData.get("taskId") ?? ""));
  refresh();
  redirect(r.ok ? "/firm/tasks?notice=deleted" : `/firm/tasks/${encodeURIComponent(String(formData.get("taskId") ?? ""))}?notice=delete-error`);
}

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const body = String(formData.get("body") ?? "");
  const r = await firmTaskService().addComment(user.id, String(formData.get("taskId") ?? ""), body);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values: { body } } : { error: r.error, values: { body } };
  refresh();
  // A new stamp clears the comment box after posting.
  return {
    success: r.mentioned ? `Comment added. ${r.mentioned === 1 ? "The person you mentioned gets" : `${r.mentioned} people you mentioned get`} an inbox item.` : "Comment added.",
    values: { stamp: String(Date.now()) },
  };
}
