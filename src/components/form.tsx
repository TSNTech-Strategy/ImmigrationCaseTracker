"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the user typed, echoed back so a failed submit doesn't wipe the form
   * (React resets forms after an action). Never include passwords.
   */
  values?: Record<string, string>;
};

export function Field({
  label,
  name,
  hint,
  error: serverError,
  onChange,
  ...input
}: { label: string; name: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  // Hide a field's error once the user starts fixing it.
  const [editedAfter, setEditedAfter] = useState<string | undefined>();
  const error = serverError && editedAfter !== serverError ? serverError : undefined;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setEditedAfter(serverError);
          onChange?.(e);
        }}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] aria-[invalid=true]:border-[var(--danger)]"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--accent-fg)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
    >
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
        {state.success}
      </p>
    );
  return null;
}
