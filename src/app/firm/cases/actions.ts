"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const basis = z.enum(["LEGAL_REPRESENTATIVE", "AUTHORIZED_BY_APPLICANT"]);

export async function addFirmCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const get = (k: string) => String(formData.get(k) ?? "");
  const values = { clientId: get("clientId"), receipt: get("receipt"), nickname: get("nickname"), basis: get("basis"), evidenceRef: get("evidenceRef") };

  const fieldErrors: Record<string, string> = {};
  const b = basis.safeParse(values.basis);
  if (!b.success) fieldErrors.basis = "Choose how your firm is authorized.";
  if (!values.clientId) fieldErrors.clientId = "Choose a client.";
  if (!values.receipt.trim()) fieldErrors.receipt = "Enter the receipt number from the USCIS notice.";
  if (formData.get("attest") !== "on") fieldErrors.attest = "Please confirm the statement to continue.";
  if (Object.keys(fieldErrors).length || !b.success) return { fieldErrors, values };

  const r = await firmCaseService().addCase(user.id, { ...values, basis: b.data });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  redirect(`/firm/cases/${r.caseId}?notice=added`);
}

export async function refreshFirmCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await firmCaseService().refreshCase(user.id, String(formData.get("caseId") ?? ""));
  refresh();
  return r.status === "updated" ? { success: r.message } : { error: r.message };
}

export async function withdrawConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const r = await firmCaseService().withdrawConsent(user.id, String(formData.get("caseId") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect(`/firm/cases/${encodeURIComponent(String(formData.get("caseId")))}?notice=consent-withdrawn`);
}

export async function recordConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = { basis: String(formData.get("basis") ?? ""), evidenceRef: String(formData.get("evidenceRef") ?? "") };
  const b = basis.safeParse(values.basis);
  if (!b.success) return { fieldErrors: { basis: "Choose how your firm is authorized." }, values };
  if (formData.get("attest") !== "on") return { fieldErrors: { attest: "Please confirm the statement to continue." }, values };
  const r = await firmCaseService().recordConsent(user.id, String(formData.get("caseId") ?? ""), b.data, values.evidenceRef);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  redirect(`/firm/cases/${encodeURIComponent(String(formData.get("caseId")))}?notice=consent-recorded`);
}

export async function removeFirmCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const r = await firmCaseService().removeCase(user.id, String(formData.get("caseId") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/firm/cases?notice=removed");
}
