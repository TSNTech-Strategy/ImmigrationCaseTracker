/** Small building blocks shared by the firm workspace pages (server-rendered, no script). */

export function Avatar({ name, size = 22 }: { name: string | null | undefined; size?: number }) {
  const initials = (name ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]"
    >
      {initials || "?"}
    </span>
  );
}

export function PersonCell({ person, empty = "Unassigned" }: { person: { name: string | null; email: string } | null | undefined; empty?: string }) {
  if (!person) return <span className="text-[var(--muted)]">{empty}</span>;
  const name = person.name ?? person.email;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export const th = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
export const td = "px-3 py-2.5 align-middle";
export const btn = "inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
export const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
export const control = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-[var(--muted)]">{children}</div>}
    </div>
  );
}

export function Notice({ kind = "success", children }: { kind?: "success" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${kind === "error" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--success)] text-[var(--success)]"}`}
    >
      {children}
    </p>
  );
}
