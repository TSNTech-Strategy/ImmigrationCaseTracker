"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { addCommentAction, createTaskAction, updateTaskAction } from "./actions";

type Option = { value: string; label: string };
export type TaskFormValues = {
  title: string;
  description: string;
  status: string;
  type: string;
  priority: string;
  dueOn: string;
  assigneeId: string;
  caseId: string;
  clientId: string;
  matterId: string;
};

const select = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base aria-[invalid=true]:border-[var(--danger)]";

function Select({ name, label, value, options, error, blank }: { name: string; label: string; value: string; options: Option[]; error?: string; blank?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`field-${name}`} className="text-sm font-medium">
        {label}
      </label>
      <select id={`field-${name}`} name={name} defaultValue={value} aria-invalid={error ? true : undefined} className={select}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function TaskForm({
  mode,
  taskId,
  initial,
  statuses,
  types,
  priorities,
  members,
  cases,
  clients,
  matters,
}: {
  mode: "create" | "edit";
  taskId?: string;
  initial: TaskFormValues;
  statuses: Option[];
  types: Option[];
  priorities: Option[];
  members: Option[];
  cases: Option[];
  clients: Option[];
  matters: Option[];
}) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createTaskAction : updateTaskAction, {});
  const v = (k: keyof TaskFormValues) => state.values?.[k] ?? initial[k];
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
      <Field label="Title" name="title" required maxLength={140} autoComplete="off" placeholder="e.g. Collect tax returns for I-864" defaultValue={v("title")} error={err.title} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-description" className="text-sm font-medium">
          Description (optional)
        </label>
        <textarea id="field-description" name="description" rows={4} maxLength={4000} defaultValue={v("description")} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base" />
        {err.description && <p className="text-sm text-[var(--danger)]">{err.description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select name="status" label="Status" value={v("status")} options={statuses} error={err.status} />
        <Select name="type" label="Type" value={v("type")} options={types} error={err.type} />
        <Select name="priority" label="Priority" value={v("priority")} options={priorities} error={err.priority} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="assigneeId" label="Assigned to" value={v("assigneeId")} options={members} error={err.assigneeId} blank="Nobody" />
        <Field label="Due date (optional)" name="dueOn" type="date" defaultValue={v("dueOn")} error={err.dueOn} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="caseId" label="Case (optional)" value={v("caseId")} options={cases} error={err.caseId} blank="No case" />
        <Select name="clientId" label="Client (optional)" value={v("clientId")} options={clients} error={err.clientId} blank="Same as the case, or none" />
      </div>
      {matters.length > 0 && (
        <div className="sm:w-1/2 sm:pr-2">
          <Select name="matterId" label="Matter (optional)" value={v("matterId")} options={matters} error={err.matterId} blank="No matter" />
        </div>
      )}
      <div>
        <SubmitButton pendingText="Saving…">{mode === "create" ? "Create task" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}

export function CommentForm({ taskId, people }: { taskId: string; people: string[] }) {
  const [state, action] = useActionState<FormState, FormData>(addCommentAction, {});
  return (
    <form action={action} className="flex flex-col gap-2" key={state.values?.stamp ?? "form"}>
      <FormMessage state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      <label htmlFor="field-body" className="text-sm font-medium">
        Add a comment
      </label>
      <textarea
        id="field-body"
        name="body"
        rows={3}
        maxLength={4000}
        defaultValue={state.values?.body}
        aria-describedby="field-body-hint"
        placeholder="Write an update. Type @ and a teammate's name to notify them."
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
      />
      <p id="field-body-hint" className="text-xs text-[var(--muted)]">
        Mention: {people.map((p) => `@${p}`).join(", ")}
      </p>
      {state.fieldErrors?.body && <p className="text-sm text-[var(--danger)]">{state.fieldErrors.body}</p>}
      <div>
        <SubmitButton pendingText="Posting…">Comment</SubmitButton>
      </div>
    </form>
  );
}
