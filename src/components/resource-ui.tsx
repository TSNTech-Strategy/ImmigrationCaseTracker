import Link from "next/link";
import type { ResourceIcon, ResourceLink } from "@/lib/resources";

/** Simple line icons for the resource center (24×24, stroke = currentColor). */
const PATHS: Record<string, string[]> = {
  menu_book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"],
  schedule: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  groups: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  newspaper: ["M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2", "M18 14h-8", "M15 18h-5", "M10 6h8v4h-8z"],
  help: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  auto_awesome: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"],
  chat_bubble: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  calendar_month: ["M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
};

const TINT: Record<ResourceIcon["tint"], { fg: string; bg: string }> = {
  blue: { fg: "var(--accent)", bg: "var(--accent-soft)" },
  green: { fg: "var(--success)", bg: "var(--success-soft)" },
  orange: { fg: "var(--st-action)", bg: "var(--st-action-bg)" },
  pink: { fg: "var(--st-stop)", bg: "var(--st-stop-bg)" },
  purple: { fg: "#8b5cf6", bg: "color-mix(in srgb, #8b5cf6 14%, transparent)" },
  teal: { fg: "#0d9488", bg: "color-mix(in srgb, #0d9488 14%, transparent)" },
};

export function IconTile({ icon, size = 44 }: { icon: Pick<ResourceIcon, "md" | "tint">; size?: number }) {
  const t = TINT[icon.tint];
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: t.bg, color: t.fg }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {(PATHS[icon.md] ?? PATHS.help).map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** A hub card: tinted icon, title, one line, arrow. */
export function ResourceCard({ href, icon, title, summary }: { href: string; icon: Pick<ResourceIcon, "md" | "tint">; title: string; summary: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-colors hover:border-[var(--accent)]"
    >
      <IconTile icon={icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-[var(--muted)]">{summary}</span>
      </span>
      <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

/** A list of links: pages on this site, or official pages opening in a new tab. */
export function LinkList({ links }: { links: ResourceLink[] }) {
  return (
    <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {links.map((l) => (
        <li key={l.url}>
          {l.url.startsWith("/") ? (
            <Link href={l.url} className="flex items-center justify-between gap-3 px-4 py-3 font-medium hover:bg-[var(--surface-2)]">
              {l.label.en} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-3 font-medium hover:bg-[var(--surface-2)]">
              <span>
                {l.label.en}
                <span className="block text-xs font-normal text-[var(--muted)]">{new URL(l.url).hostname.replace(/^www\./, "")}</span>
              </span>
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
