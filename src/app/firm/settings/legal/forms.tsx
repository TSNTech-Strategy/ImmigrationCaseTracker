"use client";

import { useActionState } from "react";
import { Field, FormMessage, type FormState } from "@/components/form";
import { useFormStatus } from "react-dom";
import { cancelDeletionAction, requestDeletionAction } from "./actions";

function Danger({ children, pending }: { children: string; pending: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className="rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
      {busy ? pending : children}
    </button>
  );
}

/** Type the firm's name to schedule the deletion. */
export function DeleteWorkspaceForm({ firmName }: { firmName: string }) {
  const [state, action] = useActionState<FormState, FormData>(requestDeletionAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label={`Type "${firmName}" to confirm`} name="confirm" autoComplete="off" defaultValue={state.values?.confirm ?? ""} error={state.fieldErrors?.confirm} />
      <div>
        <Danger pending="Scheduling…">Delete the workspace</Danger>
      </div>
    </form>
  );
}

export function CancelDeletionForm() {
  const [state, action] = useActionState<FormState, FormData>(cancelDeletionAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <div>
        <button type="submit" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
          Cancel the deletion
        </button>
      </div>
    </form>
  );
}
