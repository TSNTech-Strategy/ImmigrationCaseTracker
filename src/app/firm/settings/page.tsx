import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { TIME_ZONES } from "@/lib/firms/profile";
import { GeneralSettingsForm } from "./general-form";
import { LogoForm } from "./logo-form";
import { LOGO_ACCEPT, logoPath } from "@/lib/firms/branding";

export const metadata: Metadata = { title: "Firm settings · CasePingo" };

export default async function FirmSettingsPage() {
  const user = await requireUser("/firm/settings");
  const team = await firmService().listTeam(user.id);
  if (!team) redirect("/firm");
  const { ctx, members } = team;
  const { firm } = ctx;
  const isManager = ctx.membership.role !== "STAFF";
  const people = members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email }));
  const zone = TIME_ZONES.find((z) => z.id === firm.timeZone)?.label ?? firm.timeZone;
  const assignee = people.find((p) => p.id === firm.defaultAssigneeId)?.name ?? "Whoever adds the case";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">General</h1>
        <p className="text-sm text-[var(--muted)]">Your firm&apos;s name, logo, time zone, and who new cases go to.</p>
      </div>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        {isManager ? (
          <GeneralSettingsForm initial={{ name: firm.name, timeZone: firm.timeZone, defaultAssigneeId: firm.defaultAssigneeId ?? "" }} zones={TIME_ZONES} members={people} />
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[var(--muted)]">Firm name</dt>
              <dd className="font-medium">{firm.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Time zone</dt>
              <dd className="font-medium">{zone}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">New cases go to</dt>
              <dd className="font-medium">{assignee}</dd>
            </div>
            <p className="text-[var(--muted)] sm:col-span-3">Only an Owner or Admin can change these.</p>
          </dl>
        )}
      </section>
      <section aria-labelledby="logo-h" className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-1">
          <h2 id="logo-h" className="text-base font-semibold">
            Logo
          </h2>
          <p className="text-sm text-[var(--muted)]">Clients see it at the top of their status page, the document upload page and the emails you send them.</p>
        </div>
        {isManager ? (
          <LogoForm logo={logoPath(firm)} firmName={firm.name} accept={LOGO_ACCEPT} />
        ) : logoPath(firm) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPath(firm)!} alt={`${firm.name} logo`} className="h-14 w-auto max-w-[220px] object-contain object-left" />
        ) : (
          <p className="text-sm text-[var(--muted)]">No logo yet. Only an Owner or Admin can add one.</p>
        )}
      </section>
    </div>
  );
}
