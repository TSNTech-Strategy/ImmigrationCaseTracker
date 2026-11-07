"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmAlertService, firmUpdateService } from "@/lib/firms";
import type { UpdateAction } from "@/lib/firms/updates";

const TABS = new Set(["open", "mine", "snoozed", "done"]);

function readAction(formData: FormData): UpdateAction | null {
  switch (String(formData.get("type") ?? "")) {
    case "assign":
      return { type: "assign", assigneeId: String(formData.get("assigneeId") ?? "") || null };
    case "snooze":
      return { type: "snooze", days: Number(formData.get("days")) };
    case "resolve":
      return { type: "resolve" };
    case "reopen":
      return { type: "reopen" };
    case "send":
      return { type: "send" };
    case "skip":
      return { type: "skip" };
    default:
      return null;
  }
}

/** One action on an update in the inbox; back to the same tab with a short message. */
export async function updateAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/firm/updates");
  const tab = String(formData.get("tab") ?? "open");
  const action = readAction(formData);
  const r = action ? await firmUpdateService().act(user.id, String(formData.get("updateId") ?? ""), action) : { ok: false as const, code: "invalid" };
  const q = new URLSearchParams({ tab: TABS.has(tab) ? tab : "open", [r.ok ? "done" : "error"]: r.code });
  redirect(`/firm/updates?${q}#u-${encodeURIComponent(String(formData.get("updateId") ?? ""))}`);
}

export async function saveClientUpdateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const values = { mode: String(formData.get("mode") ?? ""), replyToEmail: String(formData.get("replyToEmail") ?? ""), contactLine: String(formData.get("contactLine") ?? "") };
  const r = await firmUpdateService().saveSettings(user.id, values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Saved. New changes follow this setting.", values };
}

export async function saveAlertSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const values = { stuckAfterDays: String(formData.get("stuckAfterDays") ?? ""), deadlineLeadDays: String(formData.get("deadlineLeadDays") ?? "") };
  const r = await firmAlertService().saveAlertSettings(user.id, { stuckAfterDays: Number(values.stuckAfterDays), deadlineLeadDays: Number(values.deadlineLeadDays) });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Saved. Alerts follow the new settings from now on.", values };
}
