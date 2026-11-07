import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmTagService } from "@/lib/firms";
import { CASE_SORTS, CASE_VIEWS, LIST_LIMIT, type CaseListView, type CaseSort } from "@/lib/firms/cases";
import { getUscisClient } from "@/lib/uscis";
import { FirmCaseList } from "./case-list";

export const metadata: Metadata = { title: "Firm cases · CasePingo" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const pick = <T extends string>(v: string | undefined, allowed: Record<T, string>): T | undefined =>
  v && v in allowed ? (v as T) : undefined;

export default async function FirmCasesPage({ searchParams }: PageProps<"/firm/cases">) {
  const user = await requireUser("/firm/cases");
  const sp = await searchParams;
  const filters = {
    clientId: one(sp.client),
    tagId: one(sp.tag),
    q: one(sp.q),
    view: pick<CaseListView>(one(sp.view), CASE_VIEWS),
    sort: pick<CaseSort>(one(sp.sort), CASE_SORTS),
  };
  const svc = firmCaseService();
  const [data, clients, tagList] = await Promise.all([svc.listCases(user.id, filters), svc.listClients(user.id), firmTagService().list(user.id)]);
  if (!data || !clients || !tagList) redirect("/firm");
  const n = await svc.counts(data.ctx);
  const tags = tagList.tags;
  const activeTag = tags.find((tg) => tg.id === filters.tagId);
  const filtered = Boolean(filters.clientId || filters.tagId || filters.q || filters.view);

  const notice = one(sp.notice);
  const message =
    notice === "removed"
      ? "The case was removed. We've stopped checking it."
      : notice === "imported"
        ? importedMessage(Number(one(sp.added)) || 0, Number(one(sp.skipped)) || 0)
        : undefined;

  const viewHref = (view?: CaseListView) => {
    const q = new URLSearchParams();
    if (filters.clientId) q.set("client", filters.clientId);
    if (filters.tagId) q.set("tag", filters.tagId);
    if (filters.q) q.set("q", filters.q);
    if (filters.sort) q.set("sort", filters.sort);
    if (view) q.set("view", view);
    const s = q.toString();
    return s ? `/firm/cases?${s}` : "/firm/cases";
  };
  const chips: { view?: CaseListView; label: string; count: number }[] = [
    { label: "All", count: n.cases },
    { view: "changed", label: "Changed this week", count: n.changed },
    { view: "failed", label: "Check failed", count: n.failed },
    { view: "no_consent", label: "No consent", count: n.unconsented },
    { view: "unchecked", label: "Not checked yet", count: n.unchecked },
  ];
  const select = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/firm/cases/import" className="rounded-md border border-[var(--border)] px-4 py-2 font-medium">
            Import CSV
          </Link>
          <Link href="/firm/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
            Add a case
          </Link>
        </div>
      </div>
      <ModeBanner mode={getUscisClient().mode} />
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}

      <nav aria-label="Case views" className="flex flex-wrap gap-2 text-sm">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={viewHref(c.view)}
            aria-current={filters.view === c.view ? "page" : undefined}
            className="rounded-full border border-[var(--border)] px-3 py-1 aria-[current=page]:border-[var(--accent)] aria-[current=page]:bg-[var(--accent)] aria-[current=page]:text-[var(--accent-fg)]"
          >
            {c.label} <span className="opacity-75">({c.count})</span>
          </Link>
        ))}
      </nav>

      <form method="get" role="search" className="grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto] lg:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        {filters.view && <input type="hidden" name="view" value={filters.view} />}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-q" className="font-medium">
            Search
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Client, label, tag, form or full receipt number"
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-client" className="font-medium">
            Client
          </label>
          <select id="filter-client" name="client" defaultValue={filters.clientId ?? ""} className={select}>
            <option value="">All clients</option>
            {clients.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-tag" className="font-medium">
            Tag
          </label>
          <select id="filter-tag" name="tag" defaultValue={filters.tagId ?? ""} className={select}>
            <option value="">All tags</option>
            {tags.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name} ({tg.caseCount})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-sort" className="font-medium">
            Sort
          </label>
          <select id="filter-sort" name="sort" defaultValue={filters.sort ?? "added"} className={select}>
            {Object.entries(CASE_SORTS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-2">
            Apply
          </button>
          {(filtered || filters.sort) && (
            <Link href="/firm/cases" className="px-1 py-2 underline underline-offset-2">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--muted)]" role="status">
          {data.truncated
            ? `Showing the first ${LIST_LIMIT} matching cases. Narrow the search to see others.`
            : `${data.cases.length} case${data.cases.length === 1 ? "" : "s"}${filtered ? " match" : ""}${activeTag ? ` the tag "${activeTag.name}"` : ""}.`}
        </p>
        <Link href="/firm/tags" className="font-medium text-[var(--accent)] hover:underline">
          {tags.length ? "Manage tags" : "Set up tags for your team"}
        </Link>
      </div>
      <FirmCaseList
        cases={data.cases}
        empty={filtered ? "No cases match these filters." : "Your firm isn't tracking any cases yet. Add a case or import a CSV file."}
      />
    </>
  );
}

function importedMessage(added: number, skipped: number) {
  const cases = `${added} case${added === 1 ? "" : "s"}`;
  const skip = skipped ? ` and skipped ${skipped} row${skipped === 1 ? "" : "s"} with problems` : "";
  return `Imported ${cases}${skip}. New cases are checked with USCIS within a few minutes.`;
}
