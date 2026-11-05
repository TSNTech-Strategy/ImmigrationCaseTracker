"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import {
  acceptInviteAction,
  changeRoleAction,
  createFirmAction,
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "./actions";
import { ROLE_LABELS } from "@/lib/firms/roles";

type Role = keyof typeof ROLE_LABELS;

const select =
  "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-[var(--accent)]";

export function CreateFirmForm() {
  const [state, action] = useActionState<FormState, FormData>(createFirmAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Firm name" name="name" required autoComplete="organization" defaultValue={state.values?.name} placeholder="e.g. Rivera Immigration Law" />
      <div>
        <SubmitButton pendingText="Creating…">Create firm workspace</SubmitButton>
      </div>
    </form>
  );
}

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Email" name="email" type="email" required autoComplete="off" defaultValue={state.values?.email} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-sm font-medium">
            Role
          </label>
          <select id="invite-role" name="role" defaultValue="STAFF" className={select}>
            <option value="STAFF">Staff</option>
            {canInviteAdmin && <option value="ADMIN">Admin</option>}
          </select>
        </div>
      </div>
      <div>
        <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState<FormState, FormData>(revokeInviteAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
        Cancel
      </button>
      {state.error && <span className="text-sm text-[var(--danger)]">{state.error}</span>}
    </form>
  );
}

export function MemberControls({
  membershipId,
  role,
  canChangeRole,
  canRemove,
  isSelf,
}: {
  membershipId: string;
  role: Role;
  canChangeRole: boolean;
  canRemove: boolean;
  isSelf: boolean;
}) {
  const [roleState, roleAction] = useActionState<FormState, FormData>(changeRoleAction, {});
  const [removeState, removeAction] = useActionState<FormState, FormData>(removeMemberAction, {});
  const msg = roleState.error ?? removeState.error ?? roleState.success ?? removeState.success;
  const isError = Boolean(roleState.error ?? removeState.error);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {canChangeRole ? (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="membershipId" value={membershipId} />
            <label className="sr-only" htmlFor={`role-${membershipId}`}>
              Role
            </label>
            <select id={`role-${membershipId}`} name="role" defaultValue={role} key={role} className={`${select} py-1.5 text-sm`}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
              Save
            </button>
          </form>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-sm">{ROLE_LABELS[role]}</span>
        )}
        {canRemove && (
          <form action={removeAction}>
            <input type="hidden" name="membershipId" value={membershipId} />
            <button type="submit" className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-sm text-[var(--danger)]">
              {isSelf ? "Leave firm" : "Remove"}
            </button>
          </form>
        )}
      </div>
      {msg && (
        <span role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(acceptInviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <div>
        <SubmitButton pendingText="Joining…">Accept invitation</SubmitButton>
      </div>
    </form>
  );
}
