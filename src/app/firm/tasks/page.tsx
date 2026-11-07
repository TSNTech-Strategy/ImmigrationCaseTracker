import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmTaskService } from "@/lib/firms";
import { DEADLINE_KINDS } from "@/lib/firms/alerts";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/firms/tasks";
import { EmptyState, Notice, btn, btnPrimary, control } from "@/components/workspace-ui";
import { TaskTable } from "./task-list";

export const metadata: Metadata = { title: "Tasks · CasePingo" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function TasksPage({ searchParams }: PageProps<"/firm/tasks">) {
  const user = await requireUser("/firm/tasks");
  const sp = await searchParams;
  const scope = one(sp.scope) === "team" ? "team" : "mine";
  const view = one(sp.view) === "calendar" ? "calendar" : "list";
  const filters = {
    scope,
    status: (["active", "done", "all"] as const).find((s) => s === one(sp.status)) ?? "active",
    type: one(sp.type),
    priority: one(sp.priority),
    due: (["overdue", "today", "week", "none"] as const).find((s) => s === one(sp.due)),
    q: one(sp.q),
  } as const;
  const svc = firmTaskService();
  const data = await svc.list(user.id, filters);
  if (!data) redirect("/firm");
  const cal = view === "calendar" ? await svc.calendar(user.id, one(sp.month) ?? "", scope) : null;
  const href = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { scope: scope === "team" ? "team" : undefined, view: view === "calendar" ? "calendar" : undefined, status: filters.status === "active" ? undefined : filters.status, type: filters.type, priority: filters.priority, due: filters.due, q: filters.q, month: one(sp.month), ...change };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/firm/tasks?${s}` : "/firm/tasks";
  };
  const back = href({});
  const filtered = Boolean(filters.type || filters.priority || filters.due || filters.q || filters.status !== "active");
  const seg = "rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:text-[var(--foreground)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          {data.counts.overdue > 0 && <span className="rounded-full bg-[var(--st-stop-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--st-stop)]">{data.counts.overdue} overdue</span>}
        </div>
        <Link href="/firm/tasks/new" className={btnPrimary}>
          New task
        </Link>
      </div>
      {one(sp.notice) === "deleted" && <Notice>Task deleted.</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <nav aria-label="Whose tasks" className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
          <Link href={href({ scope: undefined })} aria-current={scope === "mine" ? "page" : undefined} className={seg}>
            My tasks <span className="tabular-nums opacity-70">{data.counts.mine}</span>
          </Link>
          <Link href={href({ scope: "team" })} aria-current={scope === "team" ? "page" : undefined} className={seg}>
            Team tasks <span className="tabular-nums opacity-70">{data.counts.team}</span>
          </Link>
        </nav>
        <nav aria-label="View" className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
          <Link href={href({ view: undefined })} aria-current={view === "list" ? "page" : undefined} className={seg}>
            List
          </Link>
          <Link href={href({ view: "calendar" })} aria-current={view === "calendar" ? "page" : undefined} className={seg}>
            Calendar
          </Link>
        </nav>
      </div>

      {view === "list" ? (
        <>
          <form method="get" role="search" aria-label="Filter tasks" className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
            {scope === "team" && <input type="hidden" name="scope" value="team" />}
            <label>
              <span className="sr-only">Search</span>
              <input name="q" type="search" defaultValue={filters.q} placeholder="Search tasks, clients or cases" className={control} />
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select name="status" defaultValue={filters.status} className={control}>
                <option value="active">Status: active</option>
                <option value="done">Status: done</option>
                <option value="all">Status: all</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Type</span>
              <select name="type" defaultValue={filters.type ?? ""} className={control}>
                <option value="">Type: all</option>
                {Object.entries(TASK_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Priority</span>
              <select name="priority" defaultValue={filters.priority ?? ""} className={control}>
                <option value="">Priority: any</option>
                {Object.entries(TASK_PRIORITIES)
                  .filter(([v]) => v !== "NONE")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Due</span>
              <select name="due" defaultValue={filters.due ?? ""} className={control}>
                <option value="">Due: any time</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="week">Next 7 days</option>
                <option value="none">No due date</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" className={btn}>
                Apply
              </button>
              {filtered && (
                <Link href={scope === "team" ? "/firm/tasks?scope=team" : "/firm/tasks"} className="px-1 text-sm font-medium text-[var(--accent)] hover:underline">
                  Clear
                </Link>
              )}
            </div>
          </form>
          {data.tasks.length === 0 ? (
            <EmptyState title={filtered ? "No tasks match these filters" : scope === "mine" ? "Nothing on your list" : "No open team tasks"}>
              {filtered ? "Try another filter." : "Create tasks for follow-ups, form preparation, filings and reviews. Link them to a case or client so everyone sees them in context."}
            </EmptyState>
          ) : (
            <TaskTable tasks={data.tasks} today={data.today} back={back} />
          )}
        </>
      ) : (
        cal && <Calendar cal={cal} href={href} />
      )}
    </>
  );
}

function Calendar({ cal, href }: { cal: NonNullable<Awaited<ReturnType<ReturnType<typeof firmTaskService>["calendar"]>>>; href: (c: Record<string, string | undefined>) => string }) {
  const [y, m] = cal.month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  type Item = { key: string; label: string; href: string; kind: "task" | "deadline"; done: boolean; urgent: boolean };
  const byDay = new Map<number, Item[]>();
  const push = (d: Date, it: Item) => {
    const k = d.getUTCDate();
    byDay.set(k, [...(byDay.get(k) ?? []), it]);
  };
  for (const t of cal.tasks) if (t.dueOn) push(t.dueOn, { key: `t-${t.id}`, label: t.title, href: `/firm/tasks/${t.id}`, kind: "task", done: t.status === "DONE", urgent: t.priority === "URGENT" || t.priority === "HIGH" });
  for (const d of cal.deadlines) push(d.dueOn, { key: `d-${d.id}`, label: `${DEADLINE_KINDS[d.kind].label} · ${d.case.nickname ?? d.case.receiptMasked}`, href: `/firm/cases/${d.case.id}#deadlines-h`, kind: "deadline", done: false, urgent: true });
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayDay = cal.today.startsWith(cal.month) ? Number(cal.today.slice(8)) : null;
  const chip = (it: Item) =>
    `block truncate rounded px-1.5 py-0.5 text-xs ${it.kind === "deadline" ? "bg-[var(--st-action-bg)] text-[var(--st-action)] font-medium" : it.done ? "text-[var(--muted)] line-through" : "bg-[var(--surface-2)] hover:bg-[var(--st-progress-bg)]"}`;

  return (
    <section aria-label={`Calendar, ${label}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="flex gap-2 text-sm">
          <Link href={href({ month: prev })} className={btn} aria-label="Previous month">
            ←
          </Link>
          <Link href={href({ month: undefined })} className={btn}>
            Today
          </Link>
          <Link href={href({ month: next })} className={btn} aria-label="Next month">
            →
          </Link>
        </div>
      </div>
      <p className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--surface-2)] ring-1 ring-[var(--border)]" /> Task due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--st-action-bg)] ring-1 ring-[var(--st-action)]" /> Case deadline
        </span>
      </p>
      {/* Wide screens: a month grid. Phones: the same days as a list. */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] md:block">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const items = day ? (byDay.get(day) ?? []) : [];
            return (
              <div key={i} className={`min-h-28 border-b border-r border-[var(--border)] p-1.5 [&:nth-child(7n)]:border-r-0 ${day ? "" : "bg-[var(--surface-2)]/50"}`}>
                {day && (
                  <>
                    <span className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${day === todayDay ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}>{day}</span>
                    <ul className="flex flex-col gap-0.5">
                      {items.slice(0, 4).map((it) => (
                        <li key={it.key}>
                          <Link href={it.href} title={it.label} className={chip(it)}>
                            {it.label}
                          </Link>
                        </li>
                      ))}
                      {items.length > 4 && <li className="px-1.5 text-xs text-[var(--muted)]">+{items.length - 4} more</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ol className="flex flex-col gap-2 md:hidden">
        {[...byDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([day, items]) => (
            <li key={day} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="mb-1 text-sm font-semibold">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)))}</p>
              <ul className="flex flex-col gap-1">
                {items.map((it) => (
                  <li key={it.key}>
                    <Link href={it.href} className={chip(it)}>
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        {byDay.size === 0 && <li className="text-sm text-[var(--muted)]">Nothing due this month.</li>}
      </ol>
    </section>
  );
}
