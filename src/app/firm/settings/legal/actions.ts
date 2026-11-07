"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmDataService } from "@/lib/firms";

export async function requestDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const confirm = String(formData.get("confirm") ?? "");
  const r = await firmDataService().requestDeletion(user.id, confirm);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values: { confirm } } : { error: r.error, values: { confirm } };
  refresh();
  return { success: "Deletion scheduled." };
}

export async function cancelDeletionAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const r = await firmDataService().cancelDeletion(user.id);
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: "Deletion canceled. Your workspace stays as it is." };
}
