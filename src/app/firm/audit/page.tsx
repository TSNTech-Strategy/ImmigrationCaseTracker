import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { requireUser } from "@/lib/auth/session";
import { firmAuditService } from "@/lib/firms";
import { AUDIT_CATEGORIES, AUDIT_EXPORT_MAX } from "@/lib/firms/audit";
import { readAuditFilters } from "./filters";

export const metadata: Metadata = { title: "Activity · CasePingo" };

export default async function AuditPage({ searchParams }: PageProps<"/firm/audit">) {
  const user = await requireUser("/firm/audit");
  const { filters, raw, query } = readAuditFilters(await searchParams);
  const data = await firmAuditService().list(user.id, filters);
  if (!data) redirect("/firm"); // Staff and non-members
  const filtered = query.toString() !== "";
  const exportHref = `/firm/audit/export${filtered ? `?${query}` : ""}`;
  const olderHref = data.nextBefore ? `/firm/audit?${new URLSearchParams([...query, ["before", data.nextBefore]])}` : null;
  const field = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-[var(--muted)]">Every change in your firm workspace: who did it and when. Entries can&apos;t be edited or deleted.</p>
        </div>
        {/* A file download, not a page. */}
        <a href={exportHref} download className="rounded-md border border-[var(--border)] px-4 py-2 font-medium">
          Export CSV
        </a>
      </div>

      <form method="get" className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="f-category" className="font-medium">
            Type
          </label>
          <select id="f-category" name="category" defaultValue={raw.category ?? ""} className={field}>
            <option value="">Everything</option>
            {Object.entries(AUDIT_CATEGORIES).map(([v, c]) => (
              <option key={v} value={v}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-actor" className="font-medium">
            Person
          </label>
          <select id="f-actor" name="actor" defaultValue={raw.actor ?? ""} className={field}>
            <option value="">Anyone</option>
            {data.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-from" className="font-medium">
            From (UTC)
          </label>
          <input id="f-from" name="from" type="date" defaultValue={raw.from} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="f-to" className="font-medium">
            To (UTC)
          </label>
          <input id="f-to" name="to" type="date" defaultValue={raw.to} className={field} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-2">
            Apply
          </button>
          {filtered && (
            <Link href="/firm/audit" className="px-1 py-2 underline underline-offset-2">
              Clear
            </Link>
          )}
        </div>
      </form>

      {data.entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          No activity matches these filters.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {data.entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p>
                <span className="font-medium">{e.actor}</span>{" "}
                {e.href ? (
                  <Link href={e.href} className="underline-offset-2 hover:underline">
                    {e.description}
                  </Link>
                ) : (
                  e.description
                )}
              </p>
              <span className="shrink-0 text-xs text-[var(--muted)]">
                <LocalTime iso={e.createdAt.toISOString()} />
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {filters.before ? (
          <Link href={`/firm/audit${filtered ? `?${query}` : ""}`} className="underline underline-offset-2">
            ← Newest
          </Link>
        ) : (
          <span />
        )}
        {olderHref && (
          <Link href={olderHref} className="underline underline-offset-2">
            Older entries →
          </Link>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">
        The export includes up to {AUDIT_EXPORT_MAX.toLocaleString("en-US")} entries matching your filters, and is itself recorded here.
      </p>
    </>
  );
}
