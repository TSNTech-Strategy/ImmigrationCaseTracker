"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { firmTagService } from "@/lib/firms";
import { findFirmContext } from "@/lib/firms/service";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** The ids of the tags on one of the caller's firm's cases (empty for any other case). */
async function tagIdsOn(userId: string, caseId: string) {
  const ctx = await findFirmContext(prisma, userId);
  if (!ctx) return [];
  const rows = await prisma.firmCaseTag.findMany({ where: { caseId, firmId: ctx.firm.id }, select: { tagId: true } });
  return rows.map((r) => r.tagId);
}

/** Firm case page: put a tag on the case, or take it off (any member). */
export async function toggleFirmCaseTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = text(formData, "caseId");
  const tagId = text(formData, "tagId");
  const current = await tagIdsOn(user.id, caseId);
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
  const r = await firmTagService().setCaseTags(user.id, caseId, next);
  refresh();
  return r.ok ? {} : { error: r.message };
}

/** Firm case page: make a new tag and put it on the case (any member). */
export async function addFirmCaseTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = text(formData, "caseId");
  const name = text(formData, "name");
  const tags = firmTagService();
  const created = await tags.create(user.id, { name });
  if (!created.ok) return { error: created.message, values: { name } };
  const r = await tags.setCaseTags(user.id, caseId, [...(await tagIdsOn(user.id, caseId)), created.value.id]);
  refresh();
  return r.ok ? { success: `Added "${created.value.name}".` } : { error: r.message };
}

/** Firm tags: a new tag (any member). */
export async function createFirmTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const name = text(formData, "name");
  const r = await firmTagService().create(user.id, { name, color: text(formData, "color") || undefined });
  refresh();
  return r.ok ? { success: `Added "${r.value.name}".` } : { error: r.message, values: { name } };
}

/** Firm tags: rename and recolor (Owner or Admin). */
export async function updateFirmTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await firmTagService().update(user.id, text(formData, "tagId"), { name: text(formData, "name"), color: text(formData, "color") });
  refresh();
  return r.ok ? { success: "Saved." } : { error: r.message };
}

/** Firm tags: delete (Owner or Admin). It comes off every case; the cases stay. */
export async function deleteFirmTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const r = await firmTagService().remove(user.id, text(formData, "tagId"));
  refresh();
  return r.ok ? {} : { error: r.message };
}
