"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { createClientAction, setClientArchivedAction, updateClientAction } from "./actions";

export type ClientValues = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryOfBirth: string;
  citizenship: string;
  aNumber: string;
  email: string;
  phone: string;
  externalRef: string;
  locale: string;
  updatesConsent: boolean;
};
type Country = { code: string; name: string };

const select = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base aria-[invalid=true]:border-[var(--danger)]";

function Section({ title, children, first = false }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <fieldset className={`flex flex-col gap-4 ${first ? "" : "border-t border-[var(--border)] pt-4"}`}>
      <legend className="mb-1 float-left w-full text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</legend>
      {children}
    </fieldset>
  );
}

function CountrySelect({ name, label, value, countries, error, blank }: { name: string; label: string; value: string; countries: Country[]; error?: string; blank: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`field-${name}`} className="text-sm font-medium">
        {label}
      </label>
      <select id={`field-${name}`} name={name} defaultValue={value} aria-invalid={error ? true : undefined} className={select}>
        <option value="">{blank}</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function ClientFields({ state, initial, countries }: { state: FormState; initial?: ClientValues; countries: Country[] }) {
  const v = (k: Exclude<keyof ClientValues, "updatesConsent">) => state.values?.[k] ?? initial?.[k] ?? "";
  const consent = state.values ? state.values.updatesConsent === "1" : (initial?.updatesConsent ?? false);
  const err = state.fieldErrors ?? {};
  return (
    <>
      <Section title="Identity" first>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" required autoComplete="off" defaultValue={v("firstName")} error={err.firstName ?? err.displayName} />
          <Field label="Last name" name="lastName" required autoComplete="off" defaultValue={v("lastName")} error={err.lastName} />
        </div>
        <div className="sm:w-1/2 sm:pr-2">
          <Field label="Date of birth (optional)" name="dateOfBirth" type="date" defaultValue={v("dateOfBirth")} error={err.dateOfBirth} hint="Stored encrypted." />
        </div>
      </Section>
      <Section title="Origin">
        <div className="grid gap-4 sm:grid-cols-2">
          <CountrySelect name="countryOfBirth" label="Country of birth (optional)" value={v("countryOfBirth")} countries={countries} error={err.countryOfBirth} blank="Not recorded" />
          <CountrySelect name="citizenship" label="Citizenship (optional)" value={v("citizenship")} countries={countries} error={err.citizenship} blank="Not recorded" />
        </div>
      </Section>
      <Section title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email (optional)" name="email" type="email" autoComplete="off" defaultValue={v("email")} error={err.email} />
          <Field label="Phone (optional)" name="phone" type="tel" autoComplete="off" defaultValue={v("phone")} error={err.phone} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-2">
          <label htmlFor="field-locale" className="text-sm font-medium">
            Preferred language
          </label>
          <select id="field-locale" name="locale" defaultValue={v("locale") || "en"} className={select}>
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
      </Section>
      <Section title="Optional">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="A-Number" name="aNumber" autoComplete="off" spellCheck={false} placeholder="A123-456-789" defaultValue={v("aNumber")} error={err.aNumber} hint="Stored encrypted; lists show only the last 4 digits." />
          <Field label="Your reference" name="externalRef" maxLength={60} autoComplete="off" placeholder="e.g. matter number" defaultValue={v("externalRef")} error={err.externalRef} />
        </div>
      </Section>
    </>
  );
}

export function CreateClientForm({ countries }: { countries: Country[] }) {
  const [state, action] = useActionState<FormState, FormData>(createClientAction, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <ClientFields state={state} countries={countries} />
      <div>
        <SubmitButton pendingText="Saving…">Create client</SubmitButton>
      </div>
    </form>
  );
}

export function EditClientForm({ clientId, initial, countries }: { clientId: string; initial: ClientValues; countries: Country[] }) {
  const [state, action] = useActionState<FormState, FormData>(updateClientAction, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="clientId" value={clientId} />
      <ClientFields state={state} initial={initial} countries={countries} />
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
