"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };

export async function addCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const values = {
    receipt: String(formData.get("receipt") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    basis: String(formData.get("basis") ?? ""),
  };
  const parsed = z
    .object({
      receipt: z.string().trim().min(1, "Enter the receipt number from your USCIS notice."),
      nickname: z.string().trim().max(60, "Use 60 characters or fewer.").optional(),
      basis: z.enum(["SELF", "AUTHORIZED_BY_APPLICANT"], { message: "Choose whose case this is." }),
      consent: z.literal("on", { message: "Please confirm the statement to continue." }),
    })
    .safeParse({
      receipt: formData.get("receipt") ?? "",
      nickname: formData.get("nickname") || undefined,
      basis: formData.get("basis") ?? undefined,
      consent: formData.get("consent") ?? undefined,
    });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }

  const result = await caseService().addCase(user.id, parsed.data);
  if (!result.ok) {
    return result.error === "invalid_receipt"
      ? { fieldErrors: { receipt: result.message }, values }
      : { error: result.message, values };
  }
  redirect(`/cases/${result.caseId}?notice=added`);
}

export async function refreshCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const caseId = String(formData.get("caseId") ?? "");
  const result = await caseService().refreshCase(user.id, caseId);
  refresh();
  return result.status === "updated" ? { success: result.message } : { error: result.message };
}

export async function removeCaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  const removed = await caseService().removeCase(user.id, String(formData.get("caseId") ?? ""));
  if (!removed) return { error: "Case not found." };
  redirect("/cases?notice=removed");
}
