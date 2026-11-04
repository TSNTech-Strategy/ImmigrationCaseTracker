"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { requestPasswordResetAction } from "../actions";

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordResetAction, {});
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <p className="text-sm text-[var(--muted)]">Enter your email and we&apos;ll send you a link to set a new password.</p>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
