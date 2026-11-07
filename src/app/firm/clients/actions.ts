"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmCaseService, firmUpdateService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };

function readClient(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    firstName: get("firstName"),
    lastName: get("lastName"),
    dateOfBirth: get("dateOfBirth"),
    countryOfBirth: get("countryOfBirth"),
    citizenship: get("citizenship"),
    aNumber: get("aNumber"),
    email: get("email"),
    phone: get("phone"),
    externalRef: get("externalRef"),
    locale: get("locale"),
    updatesConsent: formData.get("updatesConsent") === "1" ? "1" : "",
  };
}
const toInput = (v: ReturnType<typeof readClient>) => ({ ...v, updatesConsent: v.updatesConsent === "1" });

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readClient(formData);
  const r = await firmCaseService().createClient(user.id, toInput(values));
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  redirect(`/firm/clients/${r.clientId}?notice=created`);
}

export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = readClient(formData);
  const r = await firmCaseService().updateClient(user.id, String(formData.get("clientId") ?? ""), toInput(values));
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

/** Turn the client's status page on or off, or replace its link. */
export async function setClientPortalAction(formData: FormData) {
  const user = await getCurrentUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!user) redirect(`/login?next=/firm/clients/${encodeURIComponent(clientId)}`);
  const action = String(formData.get("portal") ?? "");
  if (action !== "on" && action !== "off" && action !== "new") redirect(`/firm/clients/${encodeURIComponent(clientId)}`);
  const r = await firmUpdateService().setPortal(user.id, clientId, action);
  redirect(`/firm/clients/${encodeURIComponent(clientId)}?notice=${r.ok ? `portal_${action}` : "portal_error"}#status-page-h`);
}
