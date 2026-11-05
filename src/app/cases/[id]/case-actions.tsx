"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, type FormState } from "@/components/form";
import { refreshCaseAction, removeCaseAction } from "../actions";

export function RefreshButton({ caseId, free = false }: { caseId: string; free?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(refreshCaseAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <div>
        <SubmitButton pendingText="Checking with USCIS…">Check now</SubmitButton>
      </div>
      <div aria-live="polite">
        <FormMessage state={state} />
      </div>
      {free && (state.success || state.error) && (
        <p className="text-sm">
          Tired of checking?{" "}
          <a href="/settings#plan-h" className="font-semibold text-[var(--accent)] hover:underline">
            Premium checks automatically and alerts you
          </a>
          .
        </p>
      )}
    </form>
  );
}

export function RemoveCaseForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(removeCaseAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <FormMessage state={state} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>Yes, remove this case and its history. We&apos;ll stop checking it.</span>
      </label>
      <div>
        <button
          type="submit"
          className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)]"
        >
          Remove case
        </button>
      </div>
    </form>
  );
}
