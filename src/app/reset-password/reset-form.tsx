"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { updatePasswordAction } from "@/app/(auth)/actions";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
