"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form";
import { closeDeletionAction, retryAccountDeletionAction } from "./actions";

export function DeletionControls({ id, canRetry }: { id: string; canRetry: boolean }) {
  const [closeState, close] = useActionState<FormState, FormData>(closeDeletionAction, {});
  const [retryState, retry] = useActionState<FormState, FormData>(retryAccountDeletionAction, {});
  return (
    <div className="flex flex-col gap-2">
      {canRetry && (
        <form action={retry}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
            Retry deletion
          </button>
        </form>
      )}
      <form action={close} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`note-${id}`}>
          Note
        </label>
        <input
          id={`note-${id}`}
          name="note"
          placeholder="Note (required to decline)"
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
        />
        <button type="submit" name="status" value="COMPLETED" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
          Mark done
        </button>
        <button type="submit" name="status" value="REJECTED" className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-sm text-[var(--danger)]">
          Decline
        </button>
      </form>
      <FormMessage state={retryState.error || retryState.success ? retryState : closeState} />
    </div>
  );
}
