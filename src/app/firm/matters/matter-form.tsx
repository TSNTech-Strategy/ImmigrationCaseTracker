"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { createMatterAction, updateMatterAction } from "./actions";

type Kind = { value: string; label: string; hint: string };

export function MatterForm({ mode, matterId, initial, kinds }: { mode: "create" | "edit"; matterId?: string; initial: { name: string; kind: string; description: string }; kinds: Kind[] }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createMatterAction : updateMatterAction, {});
  const v = (k: keyof typeof initial) => state.values?.[k] ?? initial[k];
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {matterId && <input type="hidden" name="matterId" value={matterId} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Name" name="name" required maxLength={80} autoComplete="off" placeholder="e.g. García family, Acme Corp H-1B" defaultValue={v("name")} error={err.name} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`field-kind-${mode}`} className="text-sm font-medium">
            Kind
          </label>
          <select id={`field-kind-${mode}`} name="kind" defaultValue={v("kind")} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base">
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Description (optional)" name="description" maxLength={500} autoComplete="off" placeholder="e.g. I-130s and I-485s for the García family" defaultValue={v("description")} error={err.description} />
      <div>
        <SubmitButton pendingText="Saving…">{mode === "create" ? "Create matter" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
