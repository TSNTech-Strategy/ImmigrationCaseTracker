"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; managersOnly?: boolean; badge?: "updates" | "deadlines" };

const MAIN: Item[] = [
  { href: "/firm", label: "Dashboard" },
  { href: "/firm/updates", label: "Inbox", badge: "updates" },
  { href: "/firm/cases", label: "Cases" },
  { href: "/firm/clients", label: "Clients" },
  { href: "/firm/deadlines", label: "Deadlines", badge: "deadlines" },
];
const SETTINGS: Item[] = [
  { href: "/firm/settings", label: "General" },
  { href: "/firm/team", label: "Team" },
  { href: "/firm/tags", label: "Tags" },
  { href: "/firm/updates/settings", label: "Client updates & alerts", managersOnly: true },
  { href: "/firm/audit", label: "Activity", managersOnly: true },
  { href: "/firm/billing", label: "Plan & billing", managersOnly: true },
];

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

function GearIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

const tab =
  "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-[var(--accent)]";

/** The firm workspace's tabs, and the settings tabs when inside settings. */
export function FirmNav({ firmName, isManager, openUpdates = 0, dueDeadlines = 0 }: { firmName: string; isManager: boolean; openUpdates?: number; dueDeadlines?: number }) {
  const path = usePathname();
  const settings = SETTINGS.filter((l) => isManager || !l.managersOnly);
  const inSettings = SETTINGS.some((l) => under(path, l.href));
  const mainActive = (href: string) => !inSettings && (href === "/firm" ? path === "/firm" : under(path, href));
  const count = (b: Item["badge"]) => (b === "updates" ? openUpdates : b === "deadlines" ? dueDeadlines : 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 border-b border-[var(--border)]">
        <nav aria-label={`${firmName} workspace`} className="-mb-px flex min-w-0 overflow-x-auto">
          {MAIN.map((l) => {
            const n = count(l.badge);
            return (
              <Link key={l.href} href={l.href} aria-current={mainActive(l.href) ? "page" : undefined} className={tab}>
                {l.label}
                {n > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums ${l.badge === "updates" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--st-action-bg)] text-[var(--st-action)]"}`}
                  >
                    {n > 99 ? "99+" : n}
                    <span className="sr-only">{l.badge === "updates" ? " open" : " due within a week"}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Link href="/firm/settings" aria-current={inSettings ? "page" : undefined} className={`${tab} -mb-px shrink-0`}>
          <GearIcon />
          Settings
        </Link>
      </div>
      {inSettings && (
        <nav aria-label="Settings" className="flex flex-wrap gap-1">
          {settings.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={under(path, l.href) ? "page" : undefined}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
