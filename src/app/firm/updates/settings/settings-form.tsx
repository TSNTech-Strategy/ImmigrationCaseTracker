"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { saveAlertSettingsAction, saveClientUpdateSettingsAction } from "../actions";

type Mode = "OFF" | "REVIEW" | "AUTO";

export function ClientUpdateSettingsForm({ initial, modes }: { initial: { mode: Mode; replyToEmail: string; contactLine: string }; modes: Record<Mode, { label: string; help: string }> }) {
  const [state, action] = useActionState<FormState, FormData>(saveClientUpdateSettingsAction, {});
  const v = (k: keyof typeof initial) => state.values?.[k] ?? initial[k];
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <fieldset className="flex flex-col gap-2" aria-describedby={state.fieldErrors?.mode ? "mode-error" : undefined}>
        <legend className="mb-1 text-sm font-medium">When a client&apos;s case changes</legend>
        {(Object.keys(modes) as Mode[]).map((m) => (
          <label key={m} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--surface-2)]">
            <input type="radio" name="mode" value={m} defaultChecked={v("mode") === m} className="mt-1 accent-[var(--accent)]" />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{modes[m].label}</span>
              <span className="text-sm text-[var(--muted)]">{modes[m].help}</span>
            </span>
          </label>
        ))}
        {state.fieldErrors?.mode && (
          <p id="mode-error" className="text-sm text-[var(--danger)]">
            {state.fieldErrors.mode}
          </p>
        )}
      </fieldset>
      <Field
        label="Replies go to (optional)"
        name="replyToEmail"
        type="email"
        autoComplete="off"
        placeholder="e.g. intake@yourfirm.com"
        hint="When a client replies to an update, it goes here. Leave it blank and replies go to CasePingo instead of your firm."
        defaultValue={v("replyToEmail")}
        error={state.fieldErrors?.replyToEmail}
      />
      <Field
        label="How clients reach you (optional)"
        name="contactLine"
        maxLength={120}
        autoComplete="off"
        placeholder="e.g. Call us at (555) 010-0199, Mon–Fri 9–5."
        hint="Shown at the end of each email and on the client's status page."
        defaultValue={v("contactLine")}
        error={state.fieldErrors?.contactLine}
      />
      <div>
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

export function AlertSettingsForm({ initial, stuckChoices, leadChoices }: { initial: { stuckAfterDays: number; deadlineLeadDays: number }; stuckChoices: readonly number[]; leadChoices: readonly number[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveAlertSettingsAction, {});
  const v = (k: keyof typeof initial) => state.values?.[k] ?? String(initial[k]);
  const select = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base sm:w-72";
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-stuck" className="text-sm font-medium">
          Flag a case as stuck when USCIS hasn&apos;t changed it in
        </label>
        <select id="field-stuck" name="stuckAfterDays" defaultValue={v("stuckAfterDays")} className={select} aria-describedby="field-stuck-hint">
          {stuckChoices.map((d) => (
            <option key={d} value={d}>
              {d === 0 ? "Never (off)" : `${d} days`}
            </option>
          ))}
        </select>
        <p id="field-stuck-hint" className="text-xs text-[var(--muted)]">
          Counted from the last change USCIS shows. Finished cases (approved, denied, card delivered) are never flagged.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-lead" className="text-sm font-medium">
          Remind us before a deadline
        </label>
        <select id="field-lead" name="deadlineLeadDays" defaultValue={v("deadlineLeadDays")} className={select}>
          {leadChoices.map((d) => (
            <option key={d} value={d}>
              {d} days before
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--muted)]">Another reminder comes if a deadline passes without being marked done.</p>
      </div>
      <div>
        <SubmitButton pendingText="Saving…">Save alerts</SubmitButton>
      </div>
    </form>
  );
}
