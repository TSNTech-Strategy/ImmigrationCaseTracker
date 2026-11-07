import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { firmDashboardService, firmDataService, firmService } from "@/lib/firms";
import { BarList, ChartCard, StatTile } from "@/components/dashboard-charts";
import { LocalTime } from "@/components/local-time";
import { btn, btnPrimary, control } from "@/components/workspace-ui";
import { DEADLINE_KINDS, formatDue } from "@/lib/firms/alerts";
import { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "@/lib/firms/service";
import { FIRM_PLANS } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/firms/roles";
import { CreateFirmForm } from "./forms";

export const metadata: Metadata = { title: "Dashboard · CasePingo" };

const link = "text-xs font-medium text-[var(--accent)] hover:underline";

function Csv({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} className={link} aria-label={`Download ${title} as CSV`}>
      CSV
    </a>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <span className="flex shrink-0 items-baseline gap-3">{children}</span>;
}

const NOTICES: Record<string, string> = {
  created: "Your firm workspace is ready. Your free trial has started.",
  joined: "You've joined the firm.",
};

function trialText(trialEndsAt: Date | null, now: Date) {
  if (!trialEndsAt) return null;
  const days = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Your free trial has ended, so your firm's cases aren't being checked. An Owner can choose a plan in Billing.";
  return `Free trial: ${days} day${days === 1 ? "" : "s"} left.`;
}

export default async function FirmPage({ searchParams }: PageProps<"/firm">) {
  const user = await requireUser("/firm");
  const sp = await searchParams;
  const notice = sp.notice;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const team = await firmService().listTeam(user.id);

  if (!team) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">CasePingo Pro for law firms</h1>
        <p className="text-[var(--muted)]">
          Track your clients&apos; USCIS cases as a team. Invite attorneys and staff, give each person the right role,
          and keep a record of every change.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{TRIAL_DAYS}-day free trial, up to {TRIAL_CASE_LIMIT} cases. No card needed.</li>
          <li>Roles: Owner, Admin and Staff.</li>
          <li>Shared tags to sort cases by attorney, visa type or deadline.</li>
          <li>Your personal cases stay private and separate from the firm.</li>
        </ul>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-4 text-lg font-semibold">Create your firm workspace</h2>
          <CreateFirmForm />
        </section>
      </>
    );
  }

  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const d = await firmDashboardService().getDashboard(user.id, { assignee: one(sp.assignee) || undefined, from: one(sp.from), to: one(sp.to), matter: one(sp.matter) || undefined });
  if (!d) return null;
  const { ctx } = team;
  const trial = ctx.firm.plan ? null : trialText(ctx.firm.trialEndsAt, new Date());
  const deletion = await firmDataService().pendingDeletion(ctx.firm.id);
  const k = d.kpis;
  const filtered = Boolean(d.filters.assignee || d.filters.from || d.filters.to || d.filters.matter);
  const qs = new URLSearchParams(Object.entries(d.filters).filter(([, v]) => v)).toString();
  const csv = (report: string) => `/firm/reports/export?report=${report}${qs ? `&${qs}` : ""}`;
  const caseLink = (extra: string) => `/firm/cases${d.filters.assignee ? `?assignee=${encodeURIComponent(d.filters.assignee)}${extra ? `&${extra}` : ""}` : extra ? `?${extra}` : ""}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">
            {ctx.firm.name} · {ctx.firm.plan ? `${FIRM_PLANS[ctx.firm.plan].label} plan` : "Free trial"} · {k.cases.toLocaleString("en-US")} of {ctx.firm.caseLimit.toLocaleString("en-US")} cases · your role: {ROLE_LABELS[ctx.membership.role]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/firm/clients/new" className={btn}>
            New client
          </Link>
          <Link href="/firm/cases/import" className={btn}>
            Import
          </Link>
          <Link href="/firm/cases/new" className={btnPrimary}>
            New case
          </Link>
        </div>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      {trial && <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">{trial}</p>}
      {deletion && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          This workspace is scheduled for deletion on {deletion.deleteAfter.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: ctx.firm.timeZone })}.{" "}
          <Link href="/firm/settings/legal" className="font-medium underline underline-offset-2">
            Details
          </Link>
        </p>
      )}

      <form method="get" aria-label="Dashboard filters" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Assignee</span>
          <select name="assignee" defaultValue={d.filters.assignee} className={`${control} w-48`}>
            <option value="">Whole firm</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {d.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {d.matters.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--muted)]">Matter</span>
            <select name="matter" defaultValue={d.filters.matter} className={`${control} w-48`}>
              <option value="">All matters</option>
              {d.matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Added from</span>
          <input type="date" name="from" defaultValue={d.filters.from} className={`${control} w-40`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">to</span>
          <input type="date" name="to" defaultValue={d.filters.to} className={`${control} w-40`} />
        </label>
        <button type="submit" className={btn}>
          Apply
        </button>
        {filtered && (
          <Link href="/firm" className="px-1 py-2 text-sm font-medium text-[var(--accent)] hover:underline">
            Clear
          </Link>
        )}
        <a href={csv("all")} className={`${btn} ml-auto`}>
          Download all reports (CSV)
        </a>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Cases" value={k.cases} note={filtered ? "Matching the filters" : "Tracked by your firm"} href={caseLink("")} />
        <StatTile label="Changed this week" value={k.changedWeek} note="New USCIS status in 7 days" href={caseLink("view=changed")} />
        <StatTile label="Open in Inbox" value={k.openItems} note="Waiting for someone" href="/firm/updates" tone="attention" />
        <StatTile label="Deadlines in 7 days" value={k.dueSoon} note="Including overdue" href="/firm/deadlines" tone="attention" />
        <StatTile label={`No change in ${k.stuckDays}+ days`} value={k.stuck} note="Unfinished cases" href="/firm/updates" tone="attention" />
        <StatTile
          label="Open document requests"
          value={k.openRequests}
          note={k.toReview > 0 ? `${k.toReview} upload${k.toReview === 1 ? "" : "s"} to review` : k.overdueRequests > 0 ? `${k.overdueRequests} past due` : "Waiting for clients"}
          href="/firm/documents/requests"
          tone="attention"
        />
      </div>
      {k.noConsent > 0 && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {k.noConsent} case{k.noConsent === 1 ? " has" : "s have"} no active consent and {k.noConsent === 1 ? "isn't" : "aren't"} being checked.{" "}
          <Link href="/firm/cases?view=no_consent" className="underline underline-offset-2">
            Review them
          </Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Status overview" subtitle="Cases by the kind of status USCIS shows" action={<Csv href={csv("status")} title="Status overview" />}>
          <BarList data={d.byStatus} status />
        </ChartCard>
        <ChartCard title="Cases by assignee" subtitle="Who each case belongs to" action={<Csv href={csv("assignee")} title="Cases by assignee" />}>
          <BarList data={d.byAssignee} />
        </ChartCard>
        <ChartCard title="Case volume by form" subtitle="Most common forms" action={<Csv href={csv("form")} title="Case volume by form" />}>
          <BarList data={d.byForm} />
        </ChartCard>
        <ChartCard title="Case categories" subtitle="Grouped by form type" action={<Csv href={csv("category")} title="Case categories" />}>
          <BarList data={d.byCategory} />
        </ChartCard>
        <ChartCard title="Time since last USCIS change" subtitle="Unfinished cases, from USCIS's own dates" action={<Csv href={csv("waiting")} title="Time since last USCIS change" />}>
          <BarList data={d.waiting} empty="No unfinished cases with a status yet." />
        </ChartCard>
        <ChartCard title="Clients by country of birth" subtitle="Clients with cases in this view" action={<Actions><Csv href={csv("country")} title="Clients by country of birth" /><Link href="/firm/clients" className={link}>All clients</Link></Actions>}>
          <BarList data={d.byCountry} unit="client" empty="No clients yet." />
        </ChartCard>
        <ChartCard title="Upcoming deadlines" subtitle="Next 14 days, and overdue" action={<Actions><Csv href={csv("deadlines")} title="Upcoming deadlines" /><Link href="/firm/deadlines" className={link}>All deadlines</Link></Actions>}>
          {d.deadlines.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">Nothing due in the next 14 days.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {d.deadlines.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/firm/cases/${x.case.id}#deadlines-h`} className="font-medium hover:underline">
                      {DEADLINE_KINDS[x.kind].label}
                    </Link>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {x.case.client?.displayName ?? "No client"} · {x.case.nickname ?? x.case.receiptMasked}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right text-xs ${x.daysLeft < 0 ? "font-semibold text-[var(--danger)]" : x.daysLeft <= 3 ? "font-semibold text-[var(--st-action)]" : "text-[var(--muted)]"}`}>
                    {formatDue(x.dueOn)}
                    <span className="block">{x.daysLeft < 0 ? `${-x.daysLeft} days overdue` : x.daysLeft === 0 ? "Today" : `In ${x.daysLeft} days`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Document requests" subtitle="Open requests, soonest due first" action={<Actions><Csv href={csv("requests")} title="Open document requests" /><Link href="/firm/documents/requests" className={link}>All requests</Link></Actions>}>
          {d.requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">No open requests. Ask a client for documents from their case or client page.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {d.requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/firm/documents/requests/${r.id}`} className="block truncate font-medium hover:underline">
                      {r.title}
                    </Link>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {r.client.displayName} · {r.accepted} of {r.required} accepted
                      {r.toReview > 0 && <span className="font-semibold text-[var(--st-action)]"> · {r.toReview} to review</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right text-xs ${r.daysLeft !== null && r.daysLeft < 0 ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                    {r.dueOn ? formatDue(r.dueOn) : "No due date"}
                    {r.daysLeft !== null && <span className="block">{r.daysLeft < 0 ? `${-r.daysLeft} days late` : r.daysLeft === 0 ? "Today" : `In ${r.daysLeft} days`}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Recent status changes" action={<Link href="/firm/updates" className="text-xs font-medium text-[var(--accent)] hover:underline">Inbox</Link>}>
          {d.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">No status changes yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {d.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/firm/cases/${r.case.id}`} className="block truncate font-medium hover:underline">
                      {r.event?.statusTitleEn ?? "Status updated"}
                    </Link>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {r.case.client?.displayName ?? "No client"} · {r.case.nickname ?? r.case.receiptMasked}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    <LocalTime iso={r.createdAt.toISOString()} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </>
  );
}
