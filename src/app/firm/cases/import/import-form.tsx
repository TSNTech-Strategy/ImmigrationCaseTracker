"use client";

import { useActionState, useState } from "react";
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

export function ImportForm({ maxRows, clients }: { maxRows: number; clients: string[] }) {
  const [state, action] = useActionState<ImportState, FormData>(importAction, {});
  const [mode, setMode] = useState<"file" | "paste">("file");
  const plan = state.plan;
  const err = state.fieldErrors ?? {};
  const tab = (m: "file" | "paste", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      aria-controls={`import-${m}`}
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-[var(--surface)] shadow-[var(--shadow)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
    >
      {label}
    </button>
  );
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <input type="hidden" name="mode" value={mode} />
      <div role="tablist" aria-label="How to add cases" className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
        {tab("file", "Upload a file")}
        {tab("paste", "Paste receipt numbers")}
      </div>

      <div id="import-file" role="tabpanel" hidden={mode !== "file"} className="flex flex-col gap-1.5">
        <label htmlFor="field-file" className="text-sm font-medium">
          CSV file
        </label>
        <input
          id="field-file"
          name="file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          aria-describedby="field-file-hint"
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <p id="field-file-hint" className="text-xs text-[var(--muted)]">
          Up to {maxRows} cases. Columns: client_name, receipt_number, and optionally client_ref, label, email, evidence, tags (separate several with
          a semicolon, e.g. &quot;Attorney: Rivera; H-1B&quot;; new tags are created).{" "}
          <a href="/firm/cases/import/template" download className="underline underline-offset-2">
            Download the template
          </a>
          .
        </p>
        <details className="text-xs text-[var(--muted)]">
          <summary className="cursor-pointer font-medium text-[var(--accent)]">Moving from Docketwise, Clio or a spreadsheet?</summary>
          <div className="mt-2 flex flex-col gap-1.5 leading-relaxed">
            <p>
              Export your matters or contacts as a CSV file (comma, semicolon or tab separated) and upload it as it is. CasePingo reads common
              column names such as Client, Contact, First Name / Last Name, Matter Number, Display Number, Matter Title and Email, and finds the
              column with receipt numbers by its contents. A cell with several receipt numbers adds one case for each.
            </p>
            <p>Columns we don&apos;t use are ignored. You always see a preview first, so you can check every row before anything is saved.</p>
          </div>
        </details>
        {state.csv && state.mode !== "paste" && !err.file && <p className="text-xs text-[var(--muted)]">Using the file you previewed. Choose another file to replace it.</p>}
        {err.file && <p className="text-sm text-[var(--danger)]">{err.file}</p>}
      </div>

      <div id="import-paste" role="tabpanel" hidden={mode !== "paste"} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-pasted" className="text-sm font-medium">
            Receipt numbers
          </label>
          <textarea
            id="field-pasted"
            name="pasted"
            rows={6}
            defaultValue={state.pasted}
            aria-describedby="field-pasted-hint"
            aria-invalid={err.pasted ? true : undefined}
            placeholder={"EAC2190012345\nIOE0912345678, WAC2312345678"}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm aria-[invalid=true]:border-[var(--danger)]"
          />
          <p id="field-pasted-hint" className="text-xs text-[var(--muted)]">
            Paste from anywhere: a list, an email or a spreadsheet column. We pick out every receipt number (3 letters and 10 digits) and add
            each as a case for the client below.
          </p>
          {err.pasted && <p className="text-sm text-[var(--danger)]">{err.pasted}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name" name="pasteClient" list="import-clients" autoComplete="off" defaultValue={state.pasteClient} error={err.pasteClient} hint="An existing client, or a new one." />
          <Field label="Client reference (optional)" name="pasteClientRef" maxLength={60} autoComplete="off" defaultValue={state.pasteClientRef} placeholder="e.g. matter number" />
        </div>
        <datalist id="import-clients">
          {clients.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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
        hint='Applies to every case you paste, and to file rows with an empty "evidence" column.'
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
            {plan.newTags > 0 && (
              <>
                {plan.newClients > 0 ? " and " : ", with "}
                <strong>{plan.newTags}</strong> new tag{plan.newTags === 1 ? "" : "s"}
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
                  <th scope="col" className="px-3 py-2 font-medium">Tags</th>
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
                    <td className="px-3 py-2">
                      {r.tags.map((tg) => (
                        <span key={tg.name} className="mr-1 inline-block whitespace-nowrap">
                          {tg.name}
                          {tg.isNew && <span className="ml-1 rounded-full border border-[var(--border)] px-1.5 text-xs">new</span>}
                          {tg !== r.tags[r.tags.length - 1] && ";"}
                        </span>
                      ))}
                    </td>
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
