"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmDocumentService } from "@/lib/firms";

const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? "");
  return s.startsWith("/firm/") && !s.startsWith("//") ? s : fallback;
};

export async function uploadDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const file = formData.get("file");
  const values = { kind: String(formData.get("kind") ?? ""), visibility: String(formData.get("visibility") ?? ""), caseId: String(formData.get("caseId") ?? ""), clientId: String(formData.get("clientId") ?? "") };
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: "Choose a file." }, values };
  const r = await firmDocumentService().upload(user.id, { data: Buffer.from(await file.arrayBuffer()), name: file.name, ...values });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: `Uploaded "${file.name}".`, values: { ...values, stamp: String(Date.now()) } };
}

export async function updateDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  const back = safeBack(formData.get("back"), "/firm/documents");
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const r = await firmDocumentService().update(user.id, String(formData.get("documentId") ?? ""), { visibility: String(formData.get("visibility") ?? "") || undefined, kind: String(formData.get("kind") ?? "") || undefined });
  refresh();
  const url = new URL(back, "http://x");
  url.searchParams.set("notice", r.ok ? "doc-updated" : "doc-error");
  redirect(`${url.pathname}${url.search}`);
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  const back = safeBack(formData.get("back"), "/firm/documents");
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const r = await firmDocumentService().remove(user.id, String(formData.get("documentId") ?? ""));
  refresh();
  const url = new URL(back, "http://x");
  url.searchParams.set("notice", r.ok ? "doc-deleted" : "doc-error");
  redirect(`${url.pathname}${url.search}`);
}
