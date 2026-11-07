"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/components/form";
import { clientUploadAction } from "./actions";

function Send({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60">
      {pending ? pendingLabel : label}
    </button>
  );
}

/** One requested document: pick a file or take a photo, then send. */
export function UploadItem({ token, itemId, lang, accept, t }: { token: string; itemId: string; lang: "en" | "es"; accept: string; t: { choose: string; send: string; sending: string; hint: string } }) {
  const [state, action] = useActionState<FormState, FormData>(clientUploadAction, {});
  return (
    <form action={action} className="flex flex-col gap-2" key={state.values?.stamp ?? "form"}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="lang" value={lang} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t.choose}</span>
        <input
          type="file"
          name="file"
          accept={accept}
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <span className="text-xs text-[var(--muted)]">{t.hint}</span>
      </label>
      <div>
        <Send label={t.send} pending={t.sending} />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm font-medium text-[var(--success)]">
          {state.success}
        </p>
      )}
    </form>
  );
}
