"use client";

import { useActionState } from "react";
import { Field, FormMessage, type FormState } from "@/components/form";
import { useFormStatus } from "react-dom";
import { createRequestAction } from "../actions";

type Item = { label: string; labelEs: string | null; note: string | null; required: boolean };

function Buttons({ canEmail }: { canEmail: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      {canEmail && (
        <button type="submit" name="send" value="1" disabled={pending} className="rounded-md bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60">
          {pending ? "Working…" : "Create and email the client"}
        </button>
      )}
      <button type="submit" disabled={pending} className={`rounded-md px-4 py-2.5 font-medium disabled:opacity-60 ${canEmail ? "border border-[var(--border)]" : "bg-[var(--accent)] font-semibold text-[var(--accent-fg)]"}`}>
        {pending ? "Working…" : canEmail ? "Create only" : "Create request"}
      </button>
    </div>
  );
}

export function RequestForm({ clientId, caseId, checklist, checklistTitle, canEmail, defaultTitle }: { clientId: string; caseId: string; checklist: Item[]; checklistTitle: string | null; canEmail: boolean; defaultTitle: string }) {
  const [state, action] = useActionState<FormState, FormData>(createRequestAction, {});
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Title" name="title" required maxLength={120} defaultValue={v("title", defaultTitle)} error={err.title} hint="The client sees this, so write it in their language." />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-message" className="text-sm font-medium">
          Message to the client (optional)
        </label>
        <textarea id="field-message" name="message" rows={3} maxLength={1000} defaultValue={v("message")} placeholder="e.g. Please upload these by Friday so we can file your I-485." className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base" />
      </div>
      <div className="sm:w-1/2 sm:pr-2">
        <Field label="Due date (optional)" name="dueOn" type="date" defaultValue={v("dueOn")} error={err.dueOn} hint="Reminders go out 2 days before and the day after." />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Documents to request</legend>
        {checklist.length > 0 && (
          <>
            <p className="text-xs text-[var(--muted)]">From the {checklistTitle} checklist. Untick anything you already have.</p>
            <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {checklist.map((it, i) => (
                <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                  <input id={`check-${i}`} type="checkbox" name="check" value={i} defaultChecked={it.required} className="mt-1 size-4 accent-[var(--accent)]" />
                  <input type="hidden" name={`label-${i}`} value={it.label} />
                  <input type="hidden" name={`labelEs-${i}`} value={it.labelEs ?? ""} />
                  <input type="hidden" name={`note-${i}`} value={it.note ?? ""} />
                  <input type="hidden" name={`required-${i}`} value={it.required ? "1" : "0"} />
                  <label htmlFor={`check-${i}`} className="min-w-0 text-sm">
                    <span className="font-medium">{it.label}</span>
                    {!it.required && <span className="ml-1.5 text-xs text-[var(--muted)]">(if it applies)</span>}
                    {it.note && <span className="block text-xs text-[var(--muted)]">{it.note}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">{checklist.length ? "Anything else:" : "List the documents you need, one per line:"}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input key={i} name={`custom-${i}`} maxLength={160} aria-label={`Other document ${i + 1}`} placeholder={i === 0 ? "e.g. Lease or utility bill (proof of address)" : ""} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
          ))}
        </div>
        {err.items && <p className="text-sm text-[var(--danger)]">{err.items}</p>}
      </fieldset>
      {!canEmail && <p className="text-sm text-[var(--muted)]">This client has no email address. Create the request, then copy the link and send it yourself.</p>}
      <Buttons canEmail={canEmail} />
    </form>
  );
}
