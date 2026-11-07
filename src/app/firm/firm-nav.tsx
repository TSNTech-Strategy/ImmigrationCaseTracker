"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/firm", label: "Overview" },
  { href: "/firm/updates", label: "Updates" },
  { href: "/firm/deadlines", label: "Deadlines" },
  { href: "/firm/cases", label: "Cases" },
  { href: "/firm/clients", label: "Clients" },
  { href: "/firm/tags", label: "Tags" },
  { href: "/firm/team", label: "Team" },
  { href: "/firm/audit", label: "Activity", managersOnly: true },
  { href: "/firm/billing", label: "Billing", managersOnly: true },
] as const;

export function FirmNav({ firmName, isManager, openUpdates = 0, dueDeadlines = 0 }: { firmName: string; isManager: boolean; openUpdates?: number; dueDeadlines?: number }) {
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
          {l.href === "/firm/deadlines" && dueDeadlines > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--st-action-bg)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--st-action)]">
              {dueDeadlines > 99 ? "99+" : dueDeadlines}
              <span className="sr-only"> due within a week</span>
            </span>
          )}
          {l.href === "/firm/updates" && openUpdates > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--accent-fg)]">
              {openUpdates > 99 ? "99+" : openUpdates}
              <span className="sr-only"> open</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
