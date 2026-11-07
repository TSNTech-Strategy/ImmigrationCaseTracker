"use client";

import { useState } from "react";

/**
 * Share a message: the system share sheet where the browser has one, else a
 * copy to the clipboard, else the text in a box to copy by hand.
 */
export function ShareButton({ text, title, label, copiedLabel, fallbackLabel }: { text: string; title: string; label: string; copiedLabel: string; fallbackLabel: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        // The person closed the share sheet: nothing else to do.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("manual");
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
        {label}
      </button>
      <p role="status" className="text-sm text-[var(--success)]">
        {state === "copied" ? copiedLabel : ""}
      </p>
      {state === "manual" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">{fallbackLabel}</span>
          <textarea readOnly value={text} rows={8} className="rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
