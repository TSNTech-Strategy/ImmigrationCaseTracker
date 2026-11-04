"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { verifyMfaLoginAction } from "../../actions";

export function MfaForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(verifyMfaLoginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <p className="text-sm text-[var(--muted)]">Open your authenticator app and enter the 6-digit code for ImmigrationCaseTracker.</p>
      <Field
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        autoFocus
        error={state.fieldErrors?.code}
      />
      <SubmitButton pendingText="Verifying…">Verify</SubmitButton>
    </form>
  );
}
