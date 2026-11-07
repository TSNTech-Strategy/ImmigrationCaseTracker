"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type FormState } from "@/components/form";
import { control } from "@/components/workspace-ui";
import { savePreferencesAction } from "./actions";

type Prefs = { inboxView: "mine" | "all"; caseEmails: string; caseEmailKinds: string[]; awayUntil: string; backupUserId: string };

const radio = "flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--surface-2)]";

/** Each member's own settings: where the Inbox opens, USCIS change emails, and time away. */
export function PreferencesForm({ initial, colleagues, scopes, kinds, today }: { initial: Prefs; colleagues: { id: string; name: string }[]; scopes: Record<string, string>; kinds: Record<string, string>; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(savePreferencesAction, {});
  return (
    <form action={action} className="flex flex-col gap-6" noValidate key={state.values?.stamp ?? "initial"}>
      <FormMessage state={state} />
      <Fields state={state} initial={initial} colleagues={colleagues} scopes={scopes} kinds={kinds} today={today} />
    </form>
  );
}

function Fields({ state, initial, colleagues, scopes, kinds, today }: { state: FormState; initial: Prefs; colleagues: { id: string; name: string }[]; scopes: Record<string, string>; kinds: Record<string, string>; today: string }) {
  const v = state.values;
  // Inputs stay uncontrolled (defaultChecked); state only decides which sections show.
  const [emails, setEmails] = useState(v?.caseEmails ?? initial.caseEmails);
  const [away, setAway] = useState(v ? v.away === "on" : Boolean(initial.awayUntil));
  const checkedKinds = v ? v.caseEmailKinds.split(",").filter(Boolean) : initial.caseEmailKinds;
  const err = state.fieldErrors ?? {};
  return (
    <>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-semibold">Inbox</legend>
        <p className="mb-1 text-sm text-[var(--muted)]">Where the Inbox opens. You can switch tabs any time.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["mine", "Assigned to me", "Your status changes, alerts, uploads and task reminders."],
              ["all", "Whole firm", "Everything open in the firm."],
            ] as const
          ).map(([value, label, help]) => (
            <label key={value} className={radio}>
              <input type="radio" name="inboxView" value={value} defaultChecked={(v?.inboxView ?? initial.inboxView) === value} className="mt-1" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-[var(--muted)]">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-semibold">Email me when USCIS changes a case</legend>
        <p className="mb-1 text-sm text-[var(--muted)]">Separate from the emails your clients get. Changes always appear in the Inbox either way.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(scopes).map(([value, label]) => (
            <label key={value} className={radio}>
              <input type="radio" name="caseEmails" value={value} defaultChecked={emails === value} onChange={() => setEmails(value)} className="mt-1" />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
        {emails !== "none" && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4">
            <p className="text-sm font-medium">Which changes</p>
            {Object.entries(kinds).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="caseEmailKinds" value={value} defaultChecked={checkedKinds.includes(value)} />
                {label}
              </label>
            ))}
            {err.caseEmailKinds && <p className="text-sm text-[var(--danger)]">{err.caseEmailKinds}</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">Time away</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="away" defaultChecked={away} onChange={(e) => setAway(e.currentTarget.checked)} />
          I&apos;m away: send my new inbox items to a colleague
        </label>
        {away && (
          <div className="grid gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Away through</span>
              <input type="date" name="awayUntil" min={today} defaultValue={v?.awayUntil ?? initial.awayUntil} aria-invalid={err.awayUntil ? true : undefined} className={`${control} aria-[invalid=true]:border-[var(--danger)]`} />
              {err.awayUntil && <span className="text-[var(--danger)]">{err.awayUntil}</span>}
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Who covers for you</span>
              <select name="backupUserId" defaultValue={v?.backupUserId ?? initial.backupUserId} aria-invalid={err.backupUserId ? true : undefined} className={`${control} aria-[invalid=true]:border-[var(--danger)]`}>
                <option value="">Choose a colleague</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err.backupUserId && <span className="text-[var(--danger)]">{err.backupUserId}</span>}
            </label>
            <p className="text-xs text-[var(--muted)] sm:col-span-2">New status changes, alerts, client uploads and task reminders that would come to you go to them until the end of that day. Items already in your Inbox stay with you.</p>
          </div>
        )}
      </fieldset>

      <div>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </>
  );
}
