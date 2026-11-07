import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { TIME_ZONES } from "@/lib/firms/profile";
import { GeneralSettingsForm } from "./general-form";

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
        <p className="text-sm text-[var(--muted)]">Your firm&apos;s name, time zone, and who new cases go to.</p>
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
    </div>
  );
}
