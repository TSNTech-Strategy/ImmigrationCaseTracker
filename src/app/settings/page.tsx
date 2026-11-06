import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanSection } from "./plan-section";
import { AlertsForm, BulletinWatchForm, DeleteAccountForm, MfaDisable, MfaSetup, PasswordForm, ProfileForm } from "./forms";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/plans";

export const metadata: Metadata = { title: "Settings · CasePingo" };

function Section({ id, title, children, danger }: { id: string; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 rounded-lg border bg-[var(--surface)] p-6 ${danger ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser("/settings");
  const sp = await searchParams;
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  const plan = (await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } }))?.plan ?? "FREE";
  const bulletinWatch = await prisma.visaBulletinWatch.findUnique({ where: { userId: user.id }, select: { category: true, area: true, chart: true } });

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
        <PlanSection userId={user.id} plan={plan} billing={typeof sp.billing === "string" ? sp.billing : undefined} sessionId={typeof sp.session_id === "string" ? sp.session_id : undefined} />
      </Section>
      <Section id="alerts-h" title="Alerts">
        <p className="text-sm text-[var(--muted)]">Case alerts go out only when a status changes. We never send daily reminders or ads.</p>
        <AlertsForm emailOnChange={prefs?.emailOnChange ?? true} />
      </Section>
      <Section id="bulletin-h" title="Visa Bulletin">
        <p className="text-sm text-[var(--muted)]">
          Follow your green card category on the{" "}
          <Link href="/visa-bulletin" className="underline underline-offset-2">
            Visa Bulletin
          </Link>
          .
        </p>
        <BulletinWatchForm watch={bulletinWatch} alerts={PLAN_LIMITS[plan].alerts} />
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
