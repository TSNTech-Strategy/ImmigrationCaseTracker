"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { signUpAction } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, {});
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Full name" name="name" autoComplete="name" required defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" className="mt-1" aria-describedby="agree-error" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.agree && (
          <p id="agree-error" className="text-sm text-[var(--danger)]">
            {state.fieldErrors.agree}
          </p>
        )}
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
