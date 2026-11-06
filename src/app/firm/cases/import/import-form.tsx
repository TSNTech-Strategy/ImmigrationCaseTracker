"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/form";
import { FIRM_CONSENT_OPTIONS } from "@/lib/firms/consent";
import { importAction, type ImportState } from "./actions";

function Buttons({ canImport, toAdd }: { canImport: boolean; toAdd: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="intent"
        value="preview"
        disabled={pending}
        className={`rounded-md px-4 py-2.5 font-medium disabled:opacity-60 ${canImport ? "border border-[var(--border)]" : "bg-[var(--accent)] text-[var(--accent-fg)]"}`}
      >
        {pending ? "Working…" : canImport ? "Preview again" : "Preview import"}
      </button>
      {canImport && (
        <button type="submit" name="intent" value="import" disabled={pending} className="rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--accent-fg)] disabled:opacity-60">
          {pending ? "Importing…" : `Import ${toAdd} case${toAdd === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

export function ImportForm({ maxRows }: { maxRows: number }) {
  const [state, action] = useActionState<ImportState, FormData>(importAction, {});
  const plan = state.plan;
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="field-file" className="text-sm font-medium">
          CSV file
        </label>
        <input
          id="field-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          aria-describedby="field-file-hint"
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <p id="field-file-hint" className="text-xs text-[var(--muted)]">
          Up to {maxRows} cases. Columns: client_name, receipt_number, and optionally client_ref, label, evidence.{" "}
          <a href="/firm/cases/import/template" download className="underline underline-offset-2">
            Download the template
          </a>
          .
        </p>
        {state.csv && !err.file && <p className="text-xs text-[var(--muted)]">Using the file you previewed. Choose another file to replace it.</p>}
        {err.file && <p className="text-sm text-[var(--danger)]">{err.file}</p>}
      </div>
      <input type="hidden" name="csv" value={state.csv ?? ""} />

      <fieldset className="flex flex-col gap-3" aria-describedby={err.basis ? "basis-error" : undefined}>
        <legend className="mb-1 text-sm font-medium">How is your firm authorized to track these cases?</legend>
        {FIRM_CONSENT_OPTIONS.map((o, i) => (
          <label key={o.basis} className="flex items-start gap-3 rounded-md border border-[var(--border)] p-3">
            <input type="radio" name="basis" value={o.basis} defaultChecked={state.basis ? state.basis === o.basis : i === 0} className="mt-1" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{o.label}</span>
              <span className="text-sm text-[var(--muted)]">{o.statement}</span>
            </span>
          </label>
        ))}
        {err.basis && (
          <p id="basis-error" className="text-sm text-[var(--danger)]">
            {err.basis}
          </p>
        )}
      </fieldset>
      <Field
        label="Default evidence on file"
        name="evidenceRef"
        maxLength={200}
        autoComplete="off"
        placeholder="e.g. G-28 for each client in our case files"
        hint='Used for rows with an empty "evidence" column.'
        defaultValue={state.evidenceRef}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="attest" className="mt-1" defaultChecked={Boolean(plan)} key={plan ? "y" : "n"} />
          <span>I confirm the statement I selected is true for every case in this file and the evidence is on file at our firm.</span>
        </label>
        {err.attest && <p className="text-sm text-[var(--danger)]">{err.attest}</p>}
      </div>

      {plan && (
        <section aria-labelledby="preview-h" className="flex flex-col gap-3">
          <h2 id="preview-h" className="text-lg font-semibold">
            Preview (nothing saved yet)
          </h2>
          <p role="status" className="text-sm">
            <strong>{plan.toAdd}</strong> case{plan.toAdd === 1 ? "" : "s"} will be added
            {plan.newClients > 0 && (
              <>
                , with <strong>{plan.newClients}</strong> new client{plan.newClients === 1 ? "" : "s"}
              </>
            )}
            .{" "}
            {plan.errors > 0 && (
              <span className="text-[var(--danger)]">
                {plan.errors} row{plan.errors === 1 ? " has a problem and" : "s have problems and"} will be skipped.
              </span>
            )}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Row</th>
                  <th scope="col" className="px-3 py-2 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2 font-medium">Receipt</th>
                  <th scope="col" className="px-3 py-2 font-medium">Label</th>
                  <th scope="col" className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {plan.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="px-3 py-2 text-[var(--muted)]">{r.line}</td>
                    <td className="px-3 py-2">
                      {r.clientName || "—"}
                      {r.newClient && <span className="ml-1 rounded-full border border-[var(--border)] px-1.5 text-xs">new</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.receiptMasked ?? "—"}</td>
                    <td className="px-3 py-2">{r.label ?? ""}</td>
                    <td className={`px-3 py-2 ${r.error ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{r.error ?? "Will be added"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Imported cases are checked with USCIS automatically within a few minutes, spaced out to respect USCIS limits.
          </p>
        </section>
      )}

      <Buttons canImport={Boolean(plan && plan.toAdd > 0)} toAdd={plan?.toAdd ?? 0} />
    </form>
  );
}
