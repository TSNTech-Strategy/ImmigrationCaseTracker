import Link from "next/link";

/**
 * Dashboard figures, server-rendered: stat tiles and ranked horizontal bars.
 * One hue for magnitude (status bars use the reserved status colours, always with their label);
 * values sit at the bar ends; each bar links to the matching list and shows its details on hover and focus.
 */

export type BarDatum = { key: string; label: string; value: number; href?: string };

export function StatTile({ label, value, note, href, tone }: { label: string; value: number | string; note?: string; href?: string; tone?: "attention" }) {
  const body = (
    <>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums tracking-tight ${tone === "attention" && value !== 0 ? "text-[var(--st-action)]" : ""}`}>{typeof value === "number" ? value.toLocaleString("en-US") : value}</span>
      {note && <span className="text-xs text-[var(--muted)]">{note}</span>}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const id = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 id={id} className="text-sm font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const STATUS_FILL: Record<string, string> = {
  action: "var(--st-action)",
  progress: "var(--st-progress)",
  done: "var(--st-done)",
  stop: "var(--st-stop)",
  none: "var(--st-none)",
};

/** Ranked horizontal bars: label, bar, value at the tip. `status` colours bars by status kind. */
export function BarList({ data, unit = "case", status = false, empty = "No cases yet." }: { data: BarDatum[]; unit?: string; status?: boolean; empty?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-[var(--muted)]">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-1">
      {data.map((d) => {
        const pct = total ? Math.round((d.value / total) * 100) : 0;
        const tip = `${d.label}: ${d.value.toLocaleString("en-US")} ${d.value === 1 ? unit : `${unit}s`} (${pct}%)`;
        const row = (
          <>
            <span className="truncate text-sm">{d.label}</span>
            <span className="relative h-3 min-w-0">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity group-hover:opacity-80"
                style={{ width: d.value ? `${Math.max(1.5, (d.value / max) * 100)}%` : "0", background: status ? (STATUS_FILL[d.key] ?? "var(--accent)") : "var(--accent)" }}
              />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums">{d.value.toLocaleString("en-US")}</span>
          </>
        );
        const cls = "group grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3rem] items-center gap-3 rounded-md px-2 py-1.5";
        return (
          <li key={d.key}>
            {d.href ? (
              <Link href={d.href} title={tip} aria-label={tip} className={`${cls} hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]`}>
                {row}
              </Link>
            ) : (
              <div title={tip} aria-label={tip} role="group" className={cls}>
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
