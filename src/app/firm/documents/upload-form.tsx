"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, type FormState } from "@/components/form";
import { Toast } from "@/components/toast";
import { uploadDocumentAction } from "./actions";

type Option = { value: string; label: string };
const select =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base";

/** Upload one file. Fixed case/client (case and client pages) are hidden fields; on the Documents page they're pickers. */
export function DocumentUploadForm({
  accept,
  kinds,
  visibilities,
  cases,
  clients,
  fixed,
  defaultOpen = false,
}: {
  accept: string;
  kinds: Option[];
  visibilities: Option[];
  cases?: Option[];
  clients?: Option[];
  fixed?: { caseId?: string; clientId?: string };
  defaultOpen?: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    uploadDocumentAction,
    {},
  );
  // Kept here so the panel stays open (with its message) when the page refreshes after an upload.
  const [open, setOpen] = useState(defaultOpen);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const err = state.fieldErrors ?? {};
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">
        Upload a document
      </summary>
      {/* Errors stay by the form; success is a toast (one per upload, keyed by its stamp). */}
      <FormMessage state={{ error: state.error }} />
      {state.success && <Toast key={state.values?.stamp ?? state.success} message={state.success} />}
      <form
        action={action}
        className="mt-4 flex max-w-3xl flex-col gap-4"
        key={state.values?.stamp ?? "form"}
      >
        {fixed?.caseId && (
          <input type="hidden" name="caseId" value={fixed.caseId} />
        )}
        {fixed?.clientId && (
          <input type="hidden" name="clientId" value={fixed.clientId} />
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-file" className="text-sm font-medium">
            File
          </label>
          <input
            id="doc-file"
            name="file"
            type="file"
            accept={accept}
            required
            aria-describedby="doc-file-hint"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p id="doc-file-hint" className="text-xs text-[var(--muted)]">
            PDF, photo (JPG, PNG, HEIC, WebP) or Word (.docx), up to 4 MB.
            Stored encrypted.
          </p>
          {err.file && (
            <p className="text-sm text-[var(--danger)]">{err.file}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-kind" className="text-sm font-medium">
              Kind
            </label>
            <select
              id="doc-kind"
              name="kind"
              defaultValue={v("kind", "OTHER")}
              className={select}
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-visibility" className="text-sm font-medium">
              Who can see it
            </label>
            <select
              id="doc-visibility"
              name="visibility"
              defaultValue={v("visibility", "INTERNAL")}
              className={select}
            >
              {visibilities.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            {err.visibility && (
              <p className="text-sm text-[var(--danger)]">{err.visibility}</p>
            )}
          </div>
        </div>
        {!fixed && cases && clients && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doc-case" className="text-sm font-medium">
                Case (optional)
              </label>
              <select
                id="doc-case"
                name="caseId"
                defaultValue={v("caseId")}
                className={select}
              >
                <option value="">No case</option>
                {cases.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doc-client" className="text-sm font-medium">
                Client (optional)
              </label>
              <select
                id="doc-client"
                name="clientId"
                defaultValue={v("clientId")}
                className={select}
              >
                <option value="">Same as the case, or none</option>
                {clients.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {err.clientId && (
                <p className="text-sm text-[var(--danger)]">{err.clientId}</p>
              )}
            </div>
          </div>
        )}
        <div>
          <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
        </div>
      </form>
    </details>
  );
}
