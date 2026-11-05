import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, PRICES, describeCadence, formatUsd } from "@/lib/plans";
import { AlertsForm, DeleteAccountForm, MfaDisable, MfaSetup, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings · CasePingo" };

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
  const plan = (await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } }))?.plan ?? "FREE";

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
      <Section id="plan-h" title="Plan">
        <p>
          <strong>{PLAN_LIMITS[plan].label}</strong>: up to {PLAN_LIMITS[plan].maxCases} {PLAN_LIMITS[plan].maxCases === 1 ? "case" : "cases"},
          checked {describeCadence(plan)}.
        </p>
        {plan === "FREE" && (
          <p className="text-sm text-[var(--muted)]">
            Premium (up to 10 cases for your family, checked twice a day) is coming soon for {formatUsd(PRICES.premium.yearly)} a year.
          </p>
        )}
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
