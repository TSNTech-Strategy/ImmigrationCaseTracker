"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormMessage,
  SubmitButton,
  type FormState,
} from "@/components/form";
import { addDeadlineAction } from "./actions";

export function AddDeadlineForm({
  caseId,
  kinds,
  suggested,
  defaultOpen,
}: {
  caseId: string;
  kinds: { value: string; label: string }[];
  suggested: string | null;
  defaultOpen: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    addDeadlineAction,
    {},
  );
  // Kept here so the panel stays open (with its message) when the page refreshes after saving.
  const [open, setOpen] = useState(defaultOpen);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">
        Add a deadline
      </summary>
      <div className="mt-3">
        <form
          action={action}
          className="flex flex-col gap-3"
          noValidate
          key={state.success ? "done" : "form"}
        >
          <FormMessage state={state} />
          <input type="hidden" name="caseId" value={caseId} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="field-kind" className="text-sm font-medium">
                What&apos;s due
              </label>
              <select
                id="field-kind"
                name="kind"
                defaultValue={v("kind", suggested ?? "RFE_RESPONSE")}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
              >
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Date"
              name="dueOn"
              type="date"
              required
              defaultValue={v("dueOn")}
              error={state.fieldErrors?.dueOn}
            />
          </div>
          <Field
            label="Note (optional)"
            name="note"
            maxLength={120}
            autoComplete="off"
            placeholder="e.g. Response to RFE dated Nov 3; send by FedEx"
            defaultValue={v("note")}
            error={state.fieldErrors?.note}
          />
          <div>
            <SubmitButton pendingText="Adding…">Add deadline</SubmitButton>
          </div>
        </form>
      </div>
    </details>
  );
}
