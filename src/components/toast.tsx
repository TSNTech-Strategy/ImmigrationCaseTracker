"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noSubscribe = () => () => {};
const noRegion = () => null;

/** One shared corner area, so several toasts stack instead of covering each other. */
function region(): HTMLElement {
  let el = document.getElementById("toast-region");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-region";
    el.className = "pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2";
    document.body.appendChild(el);
  }
  return el;
}

/**
 * A short confirmation in the corner after an action ("Document deleted."). Shown once: the
 * `?notice=` that carried it is removed from the address, so a refresh or the back button
 * doesn't show it again. Hides itself after a few seconds; the close button hides it sooner.
 */
export function Toast({ message, kind = "success", param = "notice" }: { message: string; kind?: "success" | "error"; param?: string }) {
  const [open, setOpen] = useState(true);
  // The corner area exists only in the browser; on the server there's nothing to show yet.
  const host = useSyncExternalStore(noSubscribe, region, noRegion);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const t = setTimeout(() => setOpen(false), kind === "error" ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [param, kind]);
  if (!open || !host) return null;
  const error = kind === "error";
  return createPortal(
    <div
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-[var(--surface)] px-4 py-3 text-sm shadow-[var(--shadow)] motion-safe:animate-[toast-in_180ms_ease-out] ${error ? "border-[var(--danger)]" : "border-[var(--success)]"}`}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={error ? "var(--danger)" : "var(--success)"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
        {error ? <path d="M12 8v5m0 3.5h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /> : <path d="m5 12 5 5 9-10" />}
      </svg>
      <p className="flex-1 font-medium">{message}</p>
      <button type="button" onClick={() => setOpen(false)} aria-label={`Close: ${message}`} className="-mr-1 rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>,
    host,
  );
}
