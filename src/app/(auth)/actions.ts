"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { authErrorMessage } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/paths";
import { getSiteUrl } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

/** Version of the Terms/Privacy text accepted at sign-up. Bump when they change. */
const TERMS_VERSION = "2026-11-05";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const newPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  const next = safeNextPath(formData.get("next"));
  // Two-factor users go straight to the code step.
  const hasFactor = data.user?.factors?.some((f) => f.status === "verified") ?? false;
  const profile = data.user ? await prisma.user.findUnique({ where: { id: data.user.id }, select: { mfaEnrolledAt: true } }) : null;
  if (hasFactor || profile?.mfaEnrolledAt) redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter your name.").max(120),
      email,
      password: newPassword,
      agree: z.literal("on", { message: "Please accept the Terms and Privacy Policy to continue." }),
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      agree: formData.get("agree"),
    });
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/cases`,
      data: {
        name: parsed.data.name,
        locale: "en",
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) return { error: authErrorMessage(error), values };
  // Same message whether or not the email already had an account (no account enumeration).
  return { success: "Check your email for a link to confirm your account. It may take a minute to arrive." };
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { error: authErrorMessage(error), values };
  // Same answer whether or not the email exists.
  return { success: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/cases?notice=password-updated");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Second step of sign-in for users with two-factor on: verify the 6-digit code. */
export async function verifyMfaLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { fieldErrors: { code: "Enter the 6-digit code from your authenticator app." } };

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (listError || !factor) return { error: "Your session has expired. Please sign in again." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code didn't work. Check the time on your phone and try the newest code." };
  redirect(safeNextPath(formData.get("next")));
}
