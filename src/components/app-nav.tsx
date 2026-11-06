"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Main destinations in the signed-in header, with a clear "you are here"
 * marker: the current section is darker with a blue underline, and carries
 * aria-current="page" so screen readers announce it too.
 */
export function AppNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-4 overflow-x-auto whitespace-nowrap px-4 text-sm font-medium [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 py-2 transition-colors ${
              active
                ? "text-[var(--foreground)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
