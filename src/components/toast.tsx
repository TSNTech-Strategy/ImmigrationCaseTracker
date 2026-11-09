"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Toasts: a short confirmation after an action ("Passport.pdf deleted"), top-right on desktop and
 * full width at the top on phones, below the site header. Following common design-system guidance
 * (Carbon, Polaris, Material, WCAG 4.1.3):
 * - success closes by itself after a few seconds, paused while the pointer or keyboard focus is on it;
 *   errors stay until closed;
 * - announced to screen readers without moving focus (role="status"; role="alert" for errors);
 * - an icon plus text (never colour alone), a close button, no motion for reduced-motion users;
 * - at most 3 at once (MAX_VISIBLE in the region's class).
 */

export type ToastKind = "success" | "error";

const SUCCESS_MS = 5000;
const noSubscribe = () => () => {};
const noRegion = () => null;

/** One shared area, so several toasts stack (newest on top) instead of covering each other. */
function region(): HTMLElement {
  let el = document.getElementById("toast-region");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-region";
    // Newest on top; the oldest beyond three are hidden (MAX_VISIBLE).
    el.className = "pointer-events-none fixed inset-x-4 top-[4.75rem] z-50 flex flex-col-reverse items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:w-[24rem] [&>*:nth-last-child(n+4)]:hidden";
    document.body.appendChild(el);
  }
  return el;
}

export function Toast({ title, detail, kind = "success", clearCookie, clearParam }: { title: string; detail?: string; kind?: ToastKind; clearCookie?: string; clearParam?: string }) {
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(SUCCESS_MS);
  const host = useSyncExternalStore(noSubscribe, region, noRegion);
  const error = kind === "error";

  // Shown once: clear whatever carried the message, so a refresh or the back button doesn't show it again.
  useEffect(() => {
    if (clearCookie) document.cookie = `${clearCookie}=; Max-Age=0; path=/; SameSite=Lax`;
    if (clearParam) {
      const url = new URL(window.location.href);
      if (url.searchParams.has(clearParam)) {
        url.searchParams.delete(clearParam);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [clearCookie, clearParam]);

  // Success closes by itself; the countdown stops while someone is reading or using it.
  useEffect(() => {
    if (error || paused || !open) return;
    const started = Date.now();
    const t = setTimeout(() => setOpen(false), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - started));
    };
  }, [error, paused, open]);

  if (!open || !host) return null;
  return createPortal(
    <div
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-3 pl-3 pr-2 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.12)] motion-safe:animate-[toast-in_200ms_ease-out]"
    >
      <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${error ? "bg-[var(--st-stop-bg)] text-[var(--danger)]" : "bg-[var(--st-done-bg)] text-[var(--success)]"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {error ? <path d="M12 7v6m0 4h.01" /> : <path d="m5 12 5 5 9-10" />}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{title}</p>
        {detail && <p className="mt-0.5 leading-snug text-[var(--muted)]">{detail}</p>}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={`Dismiss: ${title}`}
        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>,
    host,
  );
}
