"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import {
  changePasswordAction,
  confirmMfaEnrollAction,
  deleteAccountAction,
  disableMfaAction,
  startMfaEnrollAction,
  updateAlertsAction,
  updateProfileAction,
  type MfaState,
} from "./actions";

export function ProfileForm({ name, locale }: { name: string; locale: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Field label="Full name" name="name" defaultValue={state.values?.name ?? name} autoComplete="name" required error={state.fieldErrors?.name} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-locale" className="text-sm font-medium">
          Show USCIS status text in
        </label>
        <select
          // Remount after a save so the dropdown shows the saved choice
          // (React's post-action form reset keeps a select's first default).
          key={state.values?.locale ?? locale}
          id="field-locale"
          name="locale"
          defaultValue={state.values?.locale ?? locale}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      <div>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

export function AlertsForm({ emailOnChange }: { emailOnChange: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updateAlertsAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <label className="flex items-start gap-2">
        <input type="checkbox" name="emailOnChange" defaultChecked={emailOnChange} className="mt-1" />
        <span>
          Email me when a case status changes
          <span className="block text-sm text-[var(--muted)]">Sent when our automatic checks see a new status.</span>
        </span>
      </label>
      <div>
        <SubmitButton pendingText="Saving…">Save alerts</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
      <div>
        <SubmitButton pendingText="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}

export function MfaSetup() {
  const [startState, start] = useActionState<MfaState>(startMfaEnrollAction, {});
  const [confirmState, confirm] = useActionState<MfaState, FormData>(confirmMfaEnrollAction, {});
  if (confirmState.success) return <FormMessage state={confirmState} />;
  const enrollment = startState.enrollment;

  if (!enrollment) {
    return (
      <form action={start} className="flex flex-col gap-3">
        <FormMessage state={startState} />
        <p className="text-sm">
          Add a second step to sign-in using an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <div>
          <SubmitButton pendingText="Preparing…">Set up two-factor sign-in</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form action={confirm} className="flex flex-col gap-4" noValidate>
      <FormMessage state={confirmState} />
      <input type="hidden" name="factorId" value={enrollment.factorId} />
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>
          Scan this QR code with your authenticator app:
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an inline SVG data URL */}
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" width={180} height={180} className="mt-2 rounded-md bg-white p-2" />
        </li>
        <li>
          Can&apos;t scan? Enter this key instead:{" "}
          <code className="break-all rounded bg-[var(--background)] px-1.5 py-0.5 font-mono">{enrollment.secret}</code>
        </li>
        <li>Enter the 6-digit code the app shows:</li>
      </ol>
      <Field
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={confirmState.fieldErrors?.code}
      />
      <div>
        <SubmitButton pendingText="Verifying…">Turn on two-factor</SubmitButton>
      </div>
    </form>
  );
}

export function MfaDisable() {
  const [state, action] = useActionState<FormState, FormData>(disableMfaAction, {});
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <p className="text-sm">
        Two-factor sign-in is <strong>on</strong>. You&apos;re asked for a code from your authenticator app each time you sign in.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmDisable" className="mt-1" />
        <span>Turn two-factor sign-in off (less secure).</span>
      </label>
      <div>
        <button type="submit" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">
          Turn off
        </button>
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <p className="text-sm">
        This permanently deletes your account, every case you track, their history and your consent records. It can&apos;t be undone.
      </p>
      <Field label='Type "DELETE" to confirm' name="deleteConfirm" autoComplete="off" error={state.fieldErrors?.deleteConfirm} />
      <div>
        <button
          type="submit"
          className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)]"
        >
          Delete my account
        </button>
      </div>
    </form>
  );
}
