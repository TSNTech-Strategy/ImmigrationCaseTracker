"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmMatterService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const read = (formData: FormData) => ({ name: String(formData.get("name") ?? ""), kind: String(formData.get("kind") ?? ""), description: String(formData.get("description") ?? "") });
const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? "");
  return s.startsWith("/firm/") && !s.startsWith("//") ? s : fallback;
};

export async function createMatterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = read(formData);
  const r = await firmMatterService().create(user.id, values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  redirect(`/firm/matters/${r.id}?notice=created`);
}

export async function updateMatterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = read(formData);
  const r = await firmMatterService().update(user.id, String(formData.get("matterId") ?? ""), values);
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  refresh();
  return { success: "Matter saved.", values };
}

export async function archiveMatterAction(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("matterId") ?? "");
  if (!user) redirect(`/login?next=/firm/matters/${encodeURIComponent(id)}`);
  const archive = formData.get("archive") === "1";
  const r = await firmMatterService().setArchived(user.id, id, archive);
  refresh();
  redirect(`/firm/matters/${encodeURIComponent(id)}?notice=${r.ok ? (archive ? "archived" : "restored") : "archive-error"}`);
}

/** Add the ticked cases to a matter (from the matter page), or move one case (from the case page). */
export async function setCasesMatterAction(formData: FormData) {
  const user = await getCurrentUser();
  const back = safeBack(formData.get("back"), "/firm/matters");
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const ids = formData.getAll("caseIds").map(String);
  const r = await firmMatterService().setCasesMatter(user.id, ids, String(formData.get("matterId") ?? "") || null);
  refresh();
  const url = new URL(back, "http://x");
  url.searchParams.set("notice", r.ok ? (r.moved ? "matter-moved" : "matter-same") : "matter-error");
  redirect(`${url.pathname}${url.search}${url.hash}`);
}
