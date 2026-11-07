"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { tagService } from "@/lib/cases";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** The ids of the tags on one of the person's cases (empty for someone else's case). */
async function tagIdsOn(userId: string, caseId: string) {
  const rows = await prisma.trackedCaseTag.findMany({ where: { caseId, ownerUserId: userId }, select: { tagId: true } });
  return rows.map((r) => r.tagId);
}

/** Case page: put a tag on the case, or take it off. */
export async function toggleCaseTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = text(formData, "caseId");
  const tagId = text(formData, "tagId");
  const current = await tagIdsOn(user.id, caseId);
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
  const r = await tagService().setCaseTags(user.id, caseId, next);
  refresh();
  return r.ok ? {} : { error: r.message };
}

/** Case page: make a new tag and put it on the case. */
export async function addCaseTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = text(formData, "caseId");
  const name = text(formData, "name");
  const tags = tagService();
  const created = await tags.create(user.id, { name });
  if (!created.ok) return { error: created.message, values: { name } };
  const r = await tags.setCaseTags(user.id, caseId, [...(await tagIdsOn(user.id, caseId)), created.value.id]);
  refresh();
  return r.ok ? { success: `Added "${created.value.name}".` } : { error: r.message };
}

/** Manage tags: a new tag. */
export async function createTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const name = text(formData, "name");
  const r = await tagService().create(user.id, { name, color: text(formData, "color") || undefined });
  refresh();
  return r.ok ? { success: `Added "${r.value.name}".` } : { error: r.message, values: { name } };
}

/** Manage tags: rename and recolor. */
export async function updateTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await tagService().update(user.id, text(formData, "tagId"), { name: text(formData, "name"), color: text(formData, "color") });
  refresh();
  return r.ok ? { success: "Saved." } : { error: r.message };
}

/** Manage tags: delete (it comes off every case; the cases stay). */
export async function deleteTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const r = await tagService().remove(user.id, text(formData, "tagId"));
  refresh();
  return r.ok ? {} : { error: r.message };
}
