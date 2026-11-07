"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmBrandingService, firmService } from "@/lib/firms";

export async function saveGeneralSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const values = { name: String(formData.get("name") ?? ""), timeZone: String(formData.get("timeZone") ?? ""), defaultAssigneeId: String(formData.get("defaultAssigneeId") ?? "") };
  const r = await firmService().saveGeneral(user.id, { ...values, defaultAssigneeId: values.defaultAssigneeId || null });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Settings saved.", values };
}

export async function saveLogoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const svc = firmBrandingService();
  if (formData.get("op") === "remove") {
    const r = await svc.removeLogo(user.id);
    if (!r.ok) return { error: r.error };
    refresh();
    return { success: "Logo removed." };
  }
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { logo: "Choose an image." } };
  const r = await svc.setLogo(user.id, { data: Buffer.from(await file.arrayBuffer()), name: file.name });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error } } : { error: r.error };
  refresh();
  return { success: "Logo saved. Clients see it on their status page, upload page and emails." };
}
