"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const role = z.enum(["OWNER", "ADMIN", "STAFF"]);

export async function createFirmAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const name = String(formData.get("name") ?? "");
  const r = await firmService().createFirm(user.id, name);
  if (!r.ok) return { error: r.error, values: { name } };
  redirect("/firm?notice=created");
}

export async function inviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const email = String(formData.get("email") ?? "");
  const parsed = role.safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Choose a role.", values: { email } };
  const r = await firmService().invite(user.id, email, parsed.data);
  if (!r.ok) return { error: r.error, values: { email } };
  refresh();
  return {
    success: r.emailSent
      ? `Invitation sent to ${email.trim().toLowerCase()}. The link works once and expires in 7 days.`
      : "The invitation was created, but the email couldn't be sent. Try again in a few minutes.",
  };
}

export async function revokeInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await firmService().revokeInvite(user.id, String(formData.get("invitationId") ?? ""));
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: "Invitation cancelled." };
}

export async function changeRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = role.safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Choose a role." };
  const r = await firmService().changeRole(user.id, String(formData.get("membershipId") ?? ""), parsed.data);
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: "Role updated." };
}

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await firmService().removeMember(user.id, String(formData.get("membershipId") ?? ""));
  if (!r.ok) return { error: r.error };
  if (r.self) redirect("/cases?notice=left-firm");
  refresh();
  return { success: "Removed from the team. Their access ended immediately." };
}

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const r = await firmService().acceptInvite(user, String(formData.get("token") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/firm?notice=joined");
}
