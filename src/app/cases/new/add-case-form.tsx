"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { addCaseAction } from "../actions";

type Option = { basis: string; label: string; statement: string };

export function AddCaseForm({ options, footnote }: { options: Option[]; footnote: string }) {
  const [state, action] = useActionState<FormState, FormData>(addCaseAction, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="Receipt number"
        name="receipt"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="EAC9999103402"
        defaultValue={state.values?.receipt}
        hint="3 letters and 10 digits, from the top of your USCIS receipt notice (Form I-797C)."
        error={state.fieldErrors?.receipt}
      />
      <Field
        label="Nickname (optional)"
        name="nickname"
        maxLength={60}
        placeholder="e.g. Mom's I-130"
        defaultValue={state.values?.nickname}
        hint="Only you see this."
        error={state.fieldErrors?.nickname}
      />

      <fieldset className="flex flex-col gap-3" aria-describedby={state.fieldErrors?.basis ? "basis-error" : undefined}>
        <legend className="mb-1 text-sm font-medium">Whose case is this?</legend>
        {options.map((o, i) => (
          <label key={o.basis} className="flex items-start gap-3 rounded-md border border-[var(--border)] p-3">
            <input type="radio" name="basis" value={o.basis} defaultChecked={state.values?.basis ? state.values.basis === o.basis : i === 0} className="mt-1" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{o.label}</span>
              <span className="text-sm text-[var(--muted)]">{o.statement}</span>
            </span>
          </label>
        ))}
        {state.fieldErrors?.basis && (
          <p id="basis-error" className="text-sm text-[var(--danger)]">
            {state.fieldErrors.basis}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1" />
          <span>I confirm the statement I selected above is true.</span>
        </label>
        {state.fieldErrors?.consent && <p className="text-sm text-[var(--danger)]">{state.fieldErrors.consent}</p>}
        <p className="text-xs text-[var(--muted)]">{footnote}</p>
      </div>

      <SubmitButton pendingText="Adding and checking with USCIS…">Add case</SubmitButton>
    </form>
  );
}
