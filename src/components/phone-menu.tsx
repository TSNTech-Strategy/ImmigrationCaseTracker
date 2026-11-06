"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The public site's phone menu. A <details> disclosure, so it still opens without
 * JavaScript; with it, the menu closes when a link is chosen (pages change without
 * a reload, which would otherwise leave it open), on a tap outside, and on Escape.
 */
export function PhoneMenu({ items }: { items: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // A new page: make sure the menu is shut (covers the browser's back and forward too).
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const d = menu.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const d = menu.current;
      if (e.key === "Escape" && d?.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Also on the same page (e.g. "For law firms" while already on Pricing).
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  const row = "rounded-md px-3 py-2.5 hover:bg-[var(--surface-2)]";

  return (
    <details ref={menu} className="relative md:hidden">
      <summary
        aria-label="Menu"
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--border)] [&::-webkit-details-marker]:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <nav
        aria-label="Menu"
        className="absolute right-0 top-11 flex w-56 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-sm font-medium shadow-[var(--shadow)]"
      >
        {items.map((n) => (
          <Link key={n.href} href={n.href} className={row} onClick={close}>
            {n.label}
          </Link>
        ))}
        <Link href="/login" className={row} onClick={close}>
          Sign in
        </Link>
        <Link href="/signup" className="mt-1 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-center font-semibold text-[var(--accent-fg)]" onClick={close}>
          Start free
        </Link>
      </nav>
    </details>
  );
}
