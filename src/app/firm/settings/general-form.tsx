"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { saveGeneralSettingsAction } from "./actions";

const select = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base aria-[invalid=true]:border-[var(--danger)]";

export function GeneralSettingsForm({
  initial,
  zones,
  members,
}: {
  initial: { name: string; timeZone: string; defaultAssigneeId: string };
  zones: readonly { id: string; label: string }[];
  members: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(saveGeneralSettingsAction, {});
  const v = (k: keyof typeof initial) => state.values?.[k] ?? initial[k];
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Firm name" name="name" required maxLength={80} autoComplete="organization" defaultValue={v("name")} error={err.name} hint="Shown to your team, on client emails and on clients' status pages." />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-timeZone" className="text-sm font-medium">
            Time zone
          </label>
          <select id="field-timeZone" name="timeZone" defaultValue={v("timeZone")} aria-invalid={err.timeZone ? true : undefined} aria-describedby="field-timeZone-hint" className={select}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
          <p id="field-timeZone-hint" className="text-xs text-[var(--muted)]">
            Sets &quot;today&quot; for deadlines and reminders.
          </p>
          {err.timeZone && <p className="text-sm text-[var(--danger)]">{err.timeZone}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-defaultAssigneeId" className="text-sm font-medium">
            Default assignee for new cases
          </label>
          <select id="field-defaultAssigneeId" name="defaultAssigneeId" defaultValue={v("defaultAssigneeId")} aria-invalid={err.defaultAssigneeId ? true : undefined} aria-describedby="field-default-hint" className={select}>
            <option value="">Whoever adds the case</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p id="field-default-hint" className="text-xs text-[var(--muted)]">
            Its updates, alerts and reminders go to this person until someone reassigns the case.
          </p>
          {err.defaultAssigneeId && <p className="text-sm text-[var(--danger)]">{err.defaultAssigneeId}</p>}
        </div>
      </div>
      <div>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
