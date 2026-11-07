"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { FIRM_CONSENT_OPTIONS } from "@/lib/firms/consent";
import {
  addFirmCaseAction,
  recordConsentAction,
  refreshFirmCaseAction,
  removeFirmCaseAction,
  withdrawConsentAction,
} from "./actions";

const select =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-[var(--accent)] aria-[invalid=true]:border-[var(--danger)]";

function ConsentFields({ state }: { state: FormState }) {
  const chosen = state.values?.basis;
  return (
    <>
      <fieldset className="flex flex-col gap-3" aria-describedby={state.fieldErrors?.basis ? "basis-error" : undefined}>
        <legend className="mb-1 text-sm font-medium">How is your firm authorized to track this case?</legend>
        {FIRM_CONSENT_OPTIONS.map((o, i) => (
          <label key={o.basis} className="flex items-start gap-3 rounded-md border border-[var(--border)] p-3">
            <input type="radio" name="basis" value={o.basis} defaultChecked={chosen ? chosen === o.basis : i === 0} className="mt-1" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{o.label}</span>
              <span className="text-sm text-[var(--muted)]">{o.statement}</span>
            </span>
          </label>
        ))}
        {state.fieldErrors?.basis && (
          <p id="basis-error" className="text-sm text-[var(--danger)]">
            {state.fieldErrors.basis}
          </p>
        )}
      </fieldset>
      <Field
        label="Evidence on file"
        name="evidenceRef"
        required
        maxLength={200}
        autoComplete="off"
        placeholder={FIRM_CONSENT_OPTIONS[0].evidenceHint}
        hint="A short reference to the G-28 or written consent in your own files. Don't upload or paste the document."
        defaultValue={state.values?.evidenceRef}
        error={state.fieldErrors?.evidenceRef}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="attest" className="mt-1" />
          <span>I confirm the statement I selected is true and the evidence is on file at our firm.</span>
        </label>
        {state.fieldErrors?.attest && <p className="text-sm text-[var(--danger)]">{state.fieldErrors.attest}</p>}
      </div>
    </>
  );
}

export function AddFirmCaseForm({
  clients,
  clientId,
  members,
  defaultAssigneeId,
}: {
  clients: { id: string; displayName: string }[];
  clientId?: string;
  members: { id: string; name: string }[];
  defaultAssigneeId: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(addFirmCaseAction, {});
  const err = state.fieldErrors?.clientId;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-clientId" className="text-sm font-medium">
          Client
        </label>
        <select
          id="field-clientId"
          name="clientId"
          defaultValue={state.values?.clientId ?? clientId ?? ""}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? "field-clientId-error" : undefined}
          className={select}
        >
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
        {err && (
          <p id="field-clientId-error" className="text-sm text-[var(--danger)]">
            {err}
          </p>
        )}
      </div>
      <Field
        label="Receipt number"
        name="receipt"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="EAC9999103402"
        hint="3 letters and 10 digits, from the client's USCIS receipt notice (Form I-797C)."
        defaultValue={state.values?.receipt}
        error={state.fieldErrors?.receipt}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-assigneeId" className="text-sm font-medium">
          Assigned to
        </label>
        <select id="field-assigneeId" name="assigneeId" defaultValue={state.values?.assigneeId ?? defaultAssigneeId} aria-describedby="field-assigneeId-hint" className={select}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p id="field-assigneeId-hint" className="text-xs text-[var(--muted)]">
          Status changes, alerts and reminders for this case go to this person.
        </p>
        {state.fieldErrors?.assigneeId && <p className="text-sm text-[var(--danger)]">{state.fieldErrors.assigneeId}</p>}
      </div>
      <Field
        label="Label (optional)"
        name="nickname"
        maxLength={60}
        placeholder="e.g. I-130 for spouse"
        defaultValue={state.values?.nickname}
        error={state.fieldErrors?.nickname}
      />
      <ConsentFields state={state} />
      <div>
        <SubmitButton pendingText="Adding and checking with USCIS…">Add case</SubmitButton>
      </div>
    </form>
  );
}

export function FirmRefreshButton({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(refreshFirmCaseAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <div>
        <SubmitButton pendingText="Checking with USCIS…">Refresh now</SubmitButton>
      </div>
      <div aria-live="polite">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function WithdrawConsentForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(withdrawConsentAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>Withdraw consent and stop all checks for this case. Use this if the client withdrew permission or the representation ended.</span>
      </label>
      <div>
        <button type="submit" className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)]">
          Withdraw consent
        </button>
      </div>
    </form>
  );
}

export function RecordConsentForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(recordConsentAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="caseId" value={caseId} />
      <ConsentFields state={state} />
      <div>
        <SubmitButton pendingText="Saving…">Record consent</SubmitButton>
      </div>
    </form>
  );
}

export function RemoveFirmCaseForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(removeFirmCaseAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>Yes, remove this case and its history. We&apos;ll stop checking it.</span>
      </label>
      <div>
        <button type="submit" className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)]">
          Remove case
        </button>
      </div>
    </form>
  );
}
