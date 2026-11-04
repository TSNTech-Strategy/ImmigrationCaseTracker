"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { prisma } from "@/lib/db";
import { authErrorMessage } from "@/lib/auth/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };
const newPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name.").max(120), locale: z.enum(["en", "es"]) })
    .safeParse({ name: formData.get("name"), locale: formData.get("locale") });
  if (!parsed.success) return { fieldErrors: { name: parsed.error.issues[0].message } };

  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.updateUser({ data: { name: parsed.data.name, locale: parsed.data.locale } });
  refresh();
  return { success: "Profile saved.", values: parsed.data };
}

export async function updateAlertsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const emailOnChange = formData.get("emailOnChange") === "on";
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, emailOnChange },
    update: { emailOnChange },
  });
  refresh();
  return { success: emailOnChange ? "We'll email you when a case status changes." : "Email alerts are off." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  return { success: "Password changed." };
}

// ---- Two-factor (TOTP) -------------------------------------------------------

/**
 * Supabase returns the QR code as "data:image/svg+xml;utf-8,<svg…>" (raw SVG,
 * non-standard parameter), which some browsers won't render. Re-encode it as a
 * standard, URL-encoded SVG data URL.
 */
function toImageSrc(qr: string): string {
  const m = /^data:image\/svg\+xml(?:;[^,]*)?,([\s\S]*)$/.exec(qr);
  if (!m) return qr;
  const svg = m[1].trimStart().startsWith("<") ? m[1] : decodeURIComponent(m[1]);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type MfaState = FormState & { enrollment?: { factorId: string; qrCode: string; secret: string } };

export async function startMfaEnrollAction(): Promise<MfaState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const supabase = await createSupabaseServerClient();

  // Clear abandoned set-up attempts first (Supabase allows only a few unverified factors).
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    issuer: "ImmigrationCaseTracker",
  });
  if (error || !data) return { error: authErrorMessage(error) };
  return { enrollment: { factorId: data.id, qrCode: toImageSrc(data.totp.qr_code), secret: data.totp.secret } };
}

export async function confirmMfaEnrollAction(prev: MfaState, formData: FormData): Promise<MfaState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ...prev, fieldErrors: { code: "Enter the 6-digit code from your app." } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ...prev, error: "That code didn't work. Check the time on your phone and try the newest code." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { mfaEnrolledAt: new Date() } }),
    prisma.auditLog.create({ data: { actorUserId: user.id, action: "mfa.enabled", targetType: "User", targetId: user.id } }),
  ]);
  // No refresh(): the panel shows its own confirmation (a refresh would swap it away).
  return { success: "Two-factor sign-in is on. You'll be asked for a code each time you sign in." };
}

export async function disableMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (user.aal !== "aal2") return { error: "Sign out and back in with your code before turning two-factor off." };
  if (formData.get("confirmDisable") !== "on") return { error: "Tick the box to confirm." };

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: authErrorMessage(error) };
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { mfaEnrolledAt: null } }),
    prisma.auditLog.create({ data: { actorUserId: user.id, action: "mfa.disabled", targetType: "User", targetId: user.id } }),
  ]);
  return { success: "Two-factor sign-in is off." };
}

// ---- Account deletion --------------------------------------------------------

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (String(formData.get("deleteConfirm") ?? "").trim() !== "DELETE") {
    return { fieldErrors: { deleteConfirm: "Type DELETE in capitals to confirm." } };
  }

  const ownsFirm = await prisma.firmMembership.findFirst({ where: { userId: user.id, role: "OWNER", revokedAt: null } });
  if (ownsFirm) return { error: "You own a law-firm workspace. Transfer ownership or close the firm before deleting your account." };

  const request = await prisma.deletionRequest.create({
    data: { requesterId: user.id, requesterEmail: user.email, scope: "ACCOUNT", targetId: user.id, status: "IN_PROGRESS" },
  });

  // Sign-in account first, so the person can't sign back in to half-deleted data.
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    await prisma.deletionRequest.update({ where: { id: request.id }, data: { status: "REQUESTED", notes: "Auth deletion failed; retry." } });
    return { error: "We couldn't delete your account right now. Your request is recorded and we'll complete it." };
  }
  // Cascades to cases, consents, events, check runs, preferences and memberships.
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.deletionRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: new Date() } });

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/?notice=account-deleted");
}
