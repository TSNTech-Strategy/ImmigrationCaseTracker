"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { createClientAction, setClientArchivedAction, updateClientAction } from "./actions";

type ClientValues = { displayName: string; email: string | null; phone: string | null; externalRef: string | null; locale: string; updatesConsent: boolean };

function ClientFields({ state, initial }: { state: FormState; initial?: ClientValues }) {
  const v = (k: Exclude<keyof ClientValues, "updatesConsent">) => state.values?.[k] ?? initial?.[k] ?? "";
  const consent = state.values ? state.values.updatesConsent === "1" : (initial?.updatesConsent ?? false);
  return (
    <>
      <Field label="Client name" name="displayName" required autoComplete="off" defaultValue={v("displayName")} error={state.fieldErrors?.displayName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email (optional)" name="email" type="email" autoComplete="off" defaultValue={v("email")} error={state.fieldErrors?.email} />
        <Field label="Phone (optional)" name="phone" type="tel" autoComplete="off" defaultValue={v("phone")} error={state.fieldErrors?.phone} />
      </div>
      <Field
        label="Your reference (optional)"
        name="externalRef"
        maxLength={60}
        autoComplete="off"
        placeholder="e.g. matter number"
        defaultValue={v("externalRef")}
        error={state.fieldErrors?.externalRef}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-locale" className="text-sm font-medium">
          Language for updates
        </label>
        <select id="field-locale" name="locale" defaultValue={v("locale") || "en"} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base sm:w-60">
          <option value="en">English</option>
          <option value="es">Español (Spanish)</option>
        </select>
      </div>
      <label className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
        <input type="checkbox" name="updatesConsent" value="1" defaultChecked={consent} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          <span className="font-medium">The client agreed to get case updates by email</span>
          <span className="block text-[var(--muted)]">Only check this once they&apos;ve said yes. CasePingo emails them only if your firm turns on client updates.</span>
        </span>
      </label>
    </>
  );
}

export function CreateClientForm() {
  const [state, action] = useActionState<FormState, FormData>(createClientAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <ClientFields state={state} />
      <div>
        <SubmitButton pendingText="Saving…">Add client</SubmitButton>
      </div>
    </form>
  );
}

export function EditClientForm({ clientId, initial }: { clientId: string; initial: ClientValues }) {
  const [state, action] = useActionState<FormState, FormData>(updateClientAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="clientId" value={clientId} />
      <ClientFields state={state} initial={initial} />
      <div>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function ArchiveClientForm({ clientId, archived }: { clientId: string; archived: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setClientArchivedAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="archive" value={archived ? "0" : "1"} />
      <div>
        <button type="submit" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium">
          {archived ? "Restore client" : "Archive client"}
        </button>
      </div>
    </form>
  );
}
