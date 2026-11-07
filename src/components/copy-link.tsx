"use client";

import { useState } from "react";

/** A read-only link with a Copy button (falls back to selecting the text). */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="copy-link" className="text-sm font-medium">
        {label}
      </label>
      <div className="flex min-w-0 gap-2">
        <input id="copy-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              (document.getElementById("copy-link") as HTMLInputElement | null)?.select();
            }
          }}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
