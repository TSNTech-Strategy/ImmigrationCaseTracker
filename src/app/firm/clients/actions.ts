"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };

function readClient(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return { displayName: get("displayName"), email: get("email"), phone: get("phone"), externalRef: get("externalRef") };
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readClient(formData);
  const r = await firmCaseService().createClient(user.id, values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  redirect(`/firm/clients/${r.clientId}?notice=created`);
}

export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readClient(formData);
  const r = await firmCaseService().updateClient(user.id, String(formData.get("clientId") ?? ""), values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Client details saved.", values };
}

export async function setClientArchivedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const archive = formData.get("archive") === "1";
  const r = await firmCaseService().setClientArchived(user.id, String(formData.get("clientId") ?? ""), archive);
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: archive ? "Client archived. Their cases keep being tracked." : "Client restored." };
}
