"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";

function initials(name: string | null | undefined, email: string) {
  const parts = (name?.trim() || email).split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * The account button at the top right ("Welcome, <name>" with initials) and
 * its menu: who is signed in, settings, plan, firm workspace, admin, sign out.
 * A disclosure (button + panel): Escape or a click outside closes it.
 */
export function AccountMenu({ name, email, isAdmin, firmMember }: { name: string | null; email: string; isAdmin: boolean; firmMember: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const fullName = name?.trim() || null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]";
  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${fullName ?? email}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-1 pr-2.5 text-sm hover:bg-[var(--surface-2)] sm:pr-3"
      >
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]">
          {initials(name, email)}
        </span>
        <span className="hidden max-w-[10rem] truncate lg:inline">
          {fullName ? (
            <>
              <span className="text-[var(--muted)]">Welcome, </span>
              <span className="font-semibold">{fullName}</span>
            </>
          ) : (
            <span className="text-[var(--muted)]">{email}</span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]">
          <div className="border-b border-[var(--border)] px-3 pb-3 pt-2">
            <p className="text-xs text-[var(--muted)]">Signed in as</p>
            {fullName && <p className="truncate font-semibold">{fullName}</p>}
            <p className="truncate text-sm text-[var(--muted)]">{email}</p>
          </div>
          <div className="flex flex-col py-1.5">
            <Link href="/settings" className={item} onClick={close}>
              Settings
            </Link>
            <Link href="/settings#plan-h" className={item} onClick={close}>
              Plan and billing
            </Link>
            <Link href="/firm" className={item} onClick={close}>
              {firmMember ? "Firm workspace" : "Set up a firm workspace"}
            </Link>
            {isAdmin && (
              <Link href="/admin" className={item} onClick={close}>
                Admin
              </Link>
            )}
          </div>
          <form action={signOutAction} className="border-t border-[var(--border)] pt-1.5">
            <button type="submit" className={`${item} font-medium text-[var(--danger)]`}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
