import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AlertsForm, DeleteAccountForm, MfaDisable, MfaSetup, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings · ImmigrationCaseTracker" };

function Section({ id, title, children, danger }: { id: string; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 rounded-xl border bg-[var(--surface)] p-6 ${danger ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });

  // Supabase is the source of truth for factors; keep our enforcement flag in step.
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = (factors?.totp?.length ?? 0) > 0;
  if (hasVerifiedTotp !== user.mfaEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnrolledAt: hasVerifiedTotp ? new Date() : null } });
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Section id="profile-h" title="Profile">
        <p className="text-sm text-[var(--muted)]">Signed in as {user.email}</p>
        <ProfileForm name={user.name ?? ""} locale={user.locale} />
      </Section>
      <Section id="alerts-h" title="Alerts">
        <AlertsForm emailOnChange={prefs?.emailOnChange ?? true} />
      </Section>
      <Section id="security-h" title="Two-factor sign-in">
        {hasVerifiedTotp ? <MfaDisable /> : <MfaSetup />}
      </Section>
      <Section id="password-h" title="Password">
        <PasswordForm />
      </Section>
      <Section id="delete-h" title="Delete account" danger>
        <DeleteAccountForm />
      </Section>
    </>
  );
}
