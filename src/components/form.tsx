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
  const isPassword = input.type === "password";
  const [reveal, setReveal] = useState(false);
  // Hide a field's error once the user starts fixing it.
  const [editedAfter, setEditedAfter] = useState<string | undefined>();
  const error = serverError && editedAfter !== serverError ? serverError : undefined;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setEditedAfter(serverError);
            onChange?.(e);
          }}
          className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] aria-[invalid=true]:border-[var(--danger)] ${isPassword ? "pr-11" : ""}`}
          {...input}
          type={isPassword && reveal ? "text" : input.type}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            aria-controls={id}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <EyeIcon open={!reveal} />
          </button>
        )}
      </div>
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
      className="rounded-xl bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-fg)] shadow-sm hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
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

/** Eye (show) / eye-off (hide) icon for password fields. Decorative: the button carries the label. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}
