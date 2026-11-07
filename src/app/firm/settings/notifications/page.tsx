import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmTeamService } from "@/lib/firms";
import { CASE_EMAIL_KINDS, CASE_EMAIL_SCOPES } from "@/lib/firms/team";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "My notifications · CasePingo" };

export default async function NotificationsPage() {
  const user = await requireUser("/firm/settings/notifications");
  const data = await firmTeamService().preferences(user.id);
  if (!data) redirect("/firm");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My notifications</h1>
        <p className="text-sm text-[var(--muted)]">Your own settings in {data.ctx.firm.name}. They don&apos;t change anyone else&apos;s.</p>
      </div>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <PreferencesForm initial={data.prefs} colleagues={data.colleagues} scopes={CASE_EMAIL_SCOPES} kinds={CASE_EMAIL_KINDS} today={data.today} />
      </section>
    </div>
  );
}
