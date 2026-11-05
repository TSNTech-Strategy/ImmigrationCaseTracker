"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/firm", label: "Overview" },
  { href: "/firm/cases", label: "Cases" },
  { href: "/firm/clients", label: "Clients" },
  { href: "/firm/team", label: "Team" },
  { href: "/firm/audit", label: "Activity", managersOnly: true },
  { href: "/firm/billing", label: "Billing", managersOnly: true },
] as const;

export function FirmNav({ firmName, isManager }: { firmName: string; isManager: boolean }) {
  const path = usePathname();
  const active = (href: string) => (href === "/firm" ? path === "/firm" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label={`${firmName} workspace`} className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2 text-sm">
      {LINKS.filter((l) => isManager || !("managersOnly" in l)).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className="rounded-md px-3 py-1.5 hover:bg-[var(--surface)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--accent)]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
