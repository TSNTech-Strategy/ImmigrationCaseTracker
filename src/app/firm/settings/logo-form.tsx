"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage, type FormState } from "@/components/form";
import { saveLogoAction } from "./actions";

function Button({ children, op, primary }: { children: string; op: "save" | "remove"; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="op"
      value={op}
      disabled={pending}
      formNoValidate={op === "remove"}
      className={
        primary
          ? "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
          : "rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-60"
      }
    >
      {children}
    </button>
  );
}

/** Upload or remove the firm's logo (Owners and Admins). */
export function LogoForm({ logo, firmName, accept }: { logo: string | null; firmName: string; accept: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveLogoAction, {});
  const err = state.fieldErrors?.logo;
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-56 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${firmName} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm text-[var(--muted)]">No logo yet</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="field-logo" className="text-sm font-medium">
            {logo ? "Replace logo" : "Upload a logo"}
          </label>
          <input
            id="field-logo"
            type="file"
            name="logo"
            accept={accept}
            aria-invalid={err ? true : undefined}
            aria-describedby="field-logo-hint"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-sm file:font-medium aria-[invalid=true]:border-[var(--danger)]"
          />
          <p id="field-logo-hint" className="text-xs text-[var(--muted)]">
            PNG, JPG or WebP up to 512 KB. A wide logo on a transparent or white background looks best.
          </p>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button op="save" primary>
          Save logo
        </Button>
        {logo && <Button op="remove">Remove logo</Button>}
      </div>
    </form>
  );
}
