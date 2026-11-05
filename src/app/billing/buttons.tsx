"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage, SubmitButton, type FormState } from "@/components/form";
import { checkoutAction, chooseCheckedCaseAction, portalAction } from "./actions";

/** A form that posts hidden fields to a billing action and shows its error, if any. */
function ActionForm({
  action: serverAction,
  fields,
  children,
  pending,
  secondary,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  children: ReactNode;
  pending: string;
  secondary?: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(serverAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {secondary ? <SecondarySubmit pending={pending}>{children}</SecondarySubmit> : <SubmitButton pendingText={pending}>{children}</SubmitButton>}
      <FormMessage state={state} />
    </form>
  );
}

function SecondarySubmit({ children, pending }: { children: ReactNode; pending: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className="rounded-md border border-[var(--border)] px-4 py-2.5 font-medium disabled:opacity-60">
      {busy ? pending : children}
    </button>
  );
}

export function CheckoutButton({ fields, children, secondary }: { fields: Record<string, string>; children: ReactNode; secondary?: boolean }) {
  return (
    <ActionForm action={checkoutAction} fields={fields} pending="Opening secure checkout…" secondary={secondary}>
      {children}
    </ActionForm>
  );
}

export function PortalButton({ scope, children = "Manage billing" }: { scope: "user" | "firm"; children?: ReactNode }) {
  return (
    <ActionForm action={portalAction} fields={{ scope }} pending="Opening billing…" secondary>
      {children}
    </ActionForm>
  );
}

export function CheckThisCaseButton({ caseId }: { caseId: string }) {
  return (
    <ActionForm action={chooseCheckedCaseAction} fields={{ caseId }} pending="Switching…" secondary>
      Check this case instead
    </ActionForm>
  );
}
