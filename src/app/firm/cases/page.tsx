import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModeBanner } from "@/components/mode-banner";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/case-tags";
import { EmptyState, Notice, PersonCell, btn, btnPrimary, control, td, th } from "@/components/workspace-ui";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmMatterService, firmService, firmTagService } from "@/lib/firms";
import { CASE_SORTS, CASE_VIEWS, LIST_LIMIT, type CaseListView, type CaseSort } from "@/lib/firms/cases";
import { CASE_CATEGORIES, CATEGORY_LABEL, type CaseCategory } from "@/lib/firms/profile";
import { formInfo } from "@/lib/case-insights";
import { nextStepFor } from "@/lib/my-cases";
import { getUscisClient } from "@/lib/uscis";
import { setCaseAssigneeAction } from "./actions";

export const metadata: Metadata = { title: "Cases · CasePingo" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const pick = <T extends string>(v: string | undefined, allowed: Record<T, unknown>): T | undefined => (v && v in allowed ? (v as T) : undefined);
const CATEGORIES = { ...CASE_CATEGORIES, other: { label: "Other" } } as Record<CaseCategory, { label: string }>;

export default async function FirmCasesPage({ searchParams }: PageProps<"/firm/cases">) {
  const user = await requireUser("/firm/cases");
  const sp = await searchParams;
  const filters = {
    clientId: one(sp.client),
    tagId: one(sp.tag),
    q: one(sp.q),
    view: pick<CaseListView>(one(sp.view), CASE_VIEWS),
    sort: pick<CaseSort>(one(sp.sort), CASE_SORTS),
    assignee: one(sp.assignee),
    category: pick<CaseCategory>(one(sp.category), CATEGORIES),
    matter: one(sp.matter),
  };
  const svc = firmCaseService();
  const [data, clients, tagList, team] = await Promise.all([svc.listCases(user.id, filters), svc.listClients(user.id), firmTagService().list(user.id), firmService().listTeam(user.id)]);
  if (!data || !clients || !tagList || !team) redirect("/firm");
  const [n, matters] = await Promise.all([svc.counts(data.ctx), firmMatterService().options(data.ctx.firm.id)]);
  const tags = tagList.tags;
  const members = team.members.map((m) => ({ id: m.userId, name: m.user.name ?? m.user.email }));
  const isManager = data.ctx.membership.role !== "STAFF";
  const filtered = Boolean(filters.clientId || filters.tagId || filters.q || filters.view || filters.assignee || filters.category || filters.matter);
  const openId = one(sp.open);
  const open = openId ? data.cases.find((c) => c.id === openId) : undefined;

  const notice = one(sp.notice);
  const message =
    notice === "removed"
      ? "The case was removed. We've stopped checking it."
      : notice === "imported"
        ? importedMessage(Number(one(sp.added)) || 0, Number(one(sp.skipped)) || 0)
        : notice === "assigned"
          ? "Case reassigned. Its open inbox items moved with it."
          : undefined;

  const href = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { client: filters.clientId, tag: filters.tagId, q: filters.q, sort: filters.sort, view: filters.view, assignee: filters.assignee, category: filters.category, matter: filters.matter, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <span className="text-sm text-[var(--muted)] tabular-nums">{n.cases} tracked</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && n.cases > 0 && (
            <a href="/firm/cases/export" className={btn} download>
              Export CSV
            </a>
          )}
          <Link href="/firm/cases/import" className={btn}>
            Import
          </Link>
          <Link href="/firm/cases/new" className={btnPrimary}>
            New case
          </Link>
        </div>
      </div>
      <ModeBanner mode={getUscisClient().mode} />
      {message && <Notice>{message}</Notice>}
      {notice === "assign-error" && <Notice kind="error">That didn&apos;t work. Choose someone on your team and try again.</Notice>}

      <nav aria-label="Case views" className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 text-sm">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={href({ view: c.view, open: undefined })}
            aria-current={filters.view === c.view ? "page" : undefined}
            className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:text-[var(--foreground)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]"
          >
            {c.label} <span className="tabular-nums opacity-70">{c.count}</span>
          </Link>
        ))}
      </nav>

      <form method="get" role="search" aria-label="Filter cases" className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))_auto]">
        {filters.view && <input type="hidden" name="view" value={filters.view} />}
        <label className="flex flex-col gap-1">
          <span className="sr-only">Search</span>
          <input name="q" type="search" defaultValue={filters.q} placeholder="Search: client, label, tag, form, receipt" className={control} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Client</span>
          <select name="client" defaultValue={filters.clientId ?? ""} className={control}>
            <option value="">All clients</option>
            {clients.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Assignee</span>
          <select name="assignee" defaultValue={filters.assignee ?? ""} className={control}>
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Category</span>
          <select name="category" defaultValue={filters.category ?? ""} className={control}>
            <option value="">All categories</option>
            {(Object.keys(CATEGORIES) as CaseCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Matter</span>
          <select name="matter" defaultValue={filters.matter ?? ""} className={control}>
            <option value="">All matters</option>
            <option value="none">Not in a matter</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Tag</span>
          <select name="tag" defaultValue={filters.tagId ?? ""} className={control}>
            <option value="">All tags</option>
            {tags.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name} ({tg.caseCount})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Sort</span>
          <select name="sort" defaultValue={filters.sort ?? "added"} className={control}>
            {Object.entries(CASE_SORTS).map(([v, l]) => (
              <option key={v} value={v}>
                Sort: {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className={btn}>
            Apply
          </button>
          {(filtered || filters.sort) && (
            <Link href="/firm/cases" className="px-1 text-sm font-medium text-[var(--accent)] hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-[var(--muted)]" role="status">
        {data.truncated ? `Showing the first ${LIST_LIMIT} matching cases. Narrow the filters to see the rest.` : `${data.cases.length} case${data.cases.length === 1 ? "" : "s"}${filtered ? " match these filters" : ""}.`}
      </p>

      {data.cases.length === 0 ? (
        <EmptyState title={filtered ? "No cases match these filters" : "Track your first case"}>
          {filtered ? (
            "Try another filter, or clear them."
          ) : (
            <>
              Add a receipt number to start checking it with USCIS, or{" "}
              <Link href="/firm/cases/import" className="font-medium text-[var(--accent)] hover:underline">
                import many at once
              </Link>
              .
            </>
          )}
        </EmptyState>
      ) : (
        <div className={`grid gap-4 ${open ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <tr>
                  <th scope="col" className={th}>Receipt</th>
                  <th scope="col" className={th}>Client</th>
                  <th scope="col" className={th}>Form</th>
                  <th scope="col" className={th}>Category</th>
                  <th scope="col" className={th}>Assignee</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Tags</th>
                  <th scope="col" className={th}>Last change</th>
                  <th scope="col" className={th}>
                    <span className="sr-only">Quick view</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.cases.map((c) => (
                  <tr key={c.id} className={c.id === openId ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}>
                    <td className={td}>
                      <Link href={`/firm/cases/${c.id}`} className="font-mono font-medium hover:underline">
                        {c.receiptMasked}
                      </Link>
                      {c.nickname && <div className="max-w-[180px] truncate text-xs text-[var(--muted)]">{c.nickname}</div>}
                    </td>
                    <td className={`${td} max-w-[180px] truncate`}>
                      {c.client ? (
                        <Link href={`/firm/clients/${c.client.id}`} className="hover:underline">
                          {c.client.displayName}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">None</span>
                      )}
                      {c.matter && <div className="truncate text-xs text-[var(--muted)]">{c.matter.name}</div>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formInfo(c.formType)?.code ?? <span className="text-[var(--muted)]">—</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{CATEGORY_LABEL(c.category)}</td>
                    <td className={`${td} max-w-[170px]`}>
                      <PersonCell person={c.assignee} />
                    </td>
                    <td className={`${td} max-w-[220px]`}>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge titleEn={c.statusTitleEn} />
                        <span className="max-w-full truncate text-xs text-[var(--muted)]" title={c.statusTitleEn ?? undefined}>
                          {c.statusTitleEn ?? "Not checked yet"}
                        </span>
                        {!c.hasConsent && <span className="text-xs font-medium text-[var(--danger)]">No consent: not checked</span>}
                      </div>
                    </td>
                    <td className={td}>
                      <TagList tags={c.tags} max={2} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-[var(--muted)]`}>
                      <LocalTime iso={c.lastChangeObservedAt?.toISOString() ?? null} fallback="—" />
                    </td>
                    <td className={`${td} text-right`}>
                      <Link
                        href={href({ open: c.id === openId ? undefined : c.id })}
                        scroll={false}
                        aria-label={`Quick view ${c.receiptMasked}`}
                        aria-expanded={c.id === openId}
                        className="rounded-md px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--surface)]"
                      >
                        {c.id === openId ? "Close" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open && (
            <aside aria-label="Case quick view" className="flex h-fit flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 lg:sticky lg:top-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-base font-semibold">{open.receiptMasked}</p>
                  <p className="text-sm text-[var(--muted)]">{[formInfo(open.formType)?.code, CATEGORY_LABEL(open.category)].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href={href({ open: undefined })} scroll={false} className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]" aria-label="Close quick view">
                  ✕
                </Link>
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <StatusBadge titleEn={open.statusTitleEn} />
                <p className="font-medium">{open.statusTitleEn ?? "Not checked yet"}</p>
                <p className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-sm">
                  <strong className="font-semibold">Next step:</strong> {nextStepFor(open.statusTitleEn, open.formType).en}
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-[var(--muted)]">Client</dt>
                <dd>{open.client?.displayName ?? "None"}</dd>
                <dt className="text-[var(--muted)]">Matter</dt>
                <dd>{open.matter ? <Link href={`/firm/matters/${open.matter.id}`} className="hover:underline">{open.matter.name}</Link> : "None"}</dd>
                <dt className="text-[var(--muted)]">Last change</dt>
                <dd>
                  <LocalTime iso={open.lastChangeObservedAt?.toISOString() ?? null} fallback="—" />
                </dd>
                <dt className="text-[var(--muted)]">Last checked</dt>
                <dd>
                  <LocalTime iso={open.lastCheckedAt?.toISOString() ?? null} />
                </dd>
              </dl>
              <form action={setCaseAssigneeAction} className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                <input type="hidden" name="caseId" value={open.id} />
                <input type="hidden" name="back" value={href({ open: open.id })} />
                <label htmlFor="qv-assignee" className="text-sm font-medium">
                  Assigned to
                </label>
                <div className="flex gap-2">
                  <select id="qv-assignee" name="assigneeId" defaultValue={open.assignee?.id ?? ""} className={control}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={btn}>
                    Save
                  </button>
                </div>
              </form>
              <Link href={`/firm/cases/${open.id}`} className={`${btnPrimary} justify-center`}>
                Open case
              </Link>
            </aside>
          )}
        </div>
      )}
    </>
  );
}

function importedMessage(added: number, skipped: number) {
  const cases = `${added} case${added === 1 ? "" : "s"}`;
  const skip = skipped ? ` and skipped ${skipped} row${skipped === 1 ? "" : "s"} with problems` : "";
  return `Imported ${cases}${skip}. New cases are checked with USCIS within a few minutes.`;
}
