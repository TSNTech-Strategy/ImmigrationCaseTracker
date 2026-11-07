import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmUpdateService } from "@/lib/firms";
import { CLIENT_UPDATE_MODES, SNOOZE_DAYS, UPDATES_TABS, type UpdatesTab } from "@/lib/firms/updates";
import { formInfo } from "@/lib/case-insights";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { updateAction } from "./actions";

export const metadata: Metadata = { title: "Updates · CasePingo" };

const DONE: Record<string, string> = {
  assigned: "Assigned.",
  unassigned: "Unassigned.",
  snoozed: "Snoozed. It comes back to Open when the time is up.",
  resolved: "Marked done.",
  reopened: "Back in Open.",
  sent: "Sent to the client.",
  skipped: "The client won't be emailed about this change.",
};
const ERRORS: Record<string, string> = {
  no_client: "The client has no email address or agreement on file any more, so nothing was sent.",
  send_failed: "The email couldn't be sent. Try again in a moment.",
  nothing_waiting: "There's no client email waiting for that change.",
  bad_assignee: "Choose someone on your team.",
  not_found: "That update isn't in your inbox any more.",
  no_firm: "You're not part of a firm workspace.",
  invalid: "That didn't work. Try again.",
};

type Item = NonNullable<Awaited<ReturnType<ReturnType<typeof firmUpdateService>["list"]>>>["items"][number];

function Hidden({ id, tab, type }: { id: string; tab: string; type: string }) {
  return (
    <>
      <input type="hidden" name="updateId" value={id} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="type" value={type} />
    </>
  );
}
const btn = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const primary = "rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const who = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email) : null);

function ClientEmail({ u, tab }: { u: Item; tab: string }) {
  switch (u.clientUpdate) {
    case "NONE":
      return <p className="text-sm text-[var(--muted)]">Client emails are off.</p>;
    case "NO_CLIENT":
      return (
        <p className="text-sm text-[var(--muted)]">
          Client not emailed: no email address or agreement on file.{" "}
          {u.client && (
            <Link href={`/firm/clients/${u.client.id}`} className="font-medium text-[var(--accent)] hover:underline">
              Edit client
            </Link>
          )}
        </p>
      );
    case "SENDING":
      return <p className="text-sm text-[var(--muted)]">Sending the client email…</p>;
    case "SENT":
      return (
        <p className="text-sm text-[var(--success)]">
          Emailed to the client <LocalTime iso={u.clientUpdateAt?.toISOString() ?? null} />
          {who(u.clientUpdateBy) ? ` by ${who(u.clientUpdateBy)}` : " automatically"}.
        </p>
      );
    case "SKIPPED":
      return <p className="text-sm text-[var(--muted)]">Not emailed to the client{who(u.clientUpdateBy) ? ` (skipped by ${who(u.clientUpdateBy)})` : ""}.</p>;
    case "PENDING":
    case "FAILED":
      return (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--st-action)] bg-[var(--st-action-bg)] p-3">
          <p className="text-sm font-semibold">{u.clientUpdate === "FAILED" ? `The client email failed${u.clientUpdateError ? ` (${u.clientUpdateError})` : ""}.` : "Client email waiting for your review"}</p>
          {u.preview && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-[var(--accent)]">Preview the email to {u.preview.to}</summary>
              <div className="mt-2 rounded-md bg-[var(--surface)] p-3">
                <p className="font-semibold">{u.preview.subject}</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">{u.preview.body}</p>
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={updateAction}>
              <Hidden id={u.id} tab={tab} type="send" />
              <button type="submit" className={primary}>
                {u.clientUpdate === "FAILED" ? "Try again" : "Send to client"}
              </button>
            </form>
            <form action={updateAction}>
              <Hidden id={u.id} tab={tab} type="skip" />
              <button type="submit" className={btn}>
                Don&apos;t email
              </button>
            </form>
          </div>
        </div>
      );
  }
}

function UpdateCard({ u, tab, members }: { u: Item; tab: string; members: { id: string; name: string }[] }) {
  const code = formInfo(u.event?.formType ?? u.case?.formType)?.code;
  const taskReason = u.kind === "TASK" ? (u.alertKey?.split(":")[2] ?? "assigned") : null;
  const badge =
    u.kind === "STUCK"
      ? "Stuck case"
      : u.kind === "DOCUMENT"
        ? "Client uploaded a document"
      : u.kind === "TASK"
        ? taskReason === "mention"
          ? "Mentioned in a task"
          : taskReason === "assigned"
            ? "Task assigned to you"
            : u.overdue
              ? "Task overdue"
              : "Task due soon"
        : u.overdue
          ? "Deadline overdue"
          : "Deadline coming up";
  const snoozed = u.snoozedActive;
  return (
    <li id={`u-${u.id}`} className="flex scroll-mt-24 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">
          {u.client ? (
            <Link href={`/firm/clients/${u.client.id}`} className="hover:underline">
              {u.client.displayName}
            </Link>
          ) : (
            "No client"
          )}
          {u.case && (
            <>
              <span className="font-normal text-[var(--muted)]"> · </span>
              <Link href={`/firm/cases/${u.case.id}`} className="font-mono text-sm font-normal hover:underline">
                {code ? `${code} · ` : ""}
                {u.case.receiptMasked}
              </Link>
            </>
          )}
        </p>
        <span className="text-sm text-[var(--muted)]">
          <LocalTime iso={u.at.toISOString()} />
        </span>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        {u.kind === "STATUS_CHANGE" ? (
          <StatusBadge titleEn={u.event?.statusTitleEn} />
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${u.overdue ? "bg-[var(--st-stop-bg)] text-[var(--st-stop)]" : "bg-[var(--st-action-bg)] text-[var(--st-action)]"}`}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {badge}
          </span>
        )}
        <p className="text-base font-medium">{u.title}</p>
        {u.kind === "STUCK" && u.case?.statusTitleEn && <p className="text-sm text-[var(--muted)]">Current status: {u.case.statusTitleEn}</p>}
        <p className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-sm">
          <span aria-hidden="true" className="text-[var(--accent)]">
            →{" "}
          </span>
          <strong className="font-semibold">{u.kind === "DEADLINE" ? "When:" : u.kind === "TASK" ? "Task:" : u.kind === "DOCUMENT" ? "To do:" : "Next step:"}</strong> {u.nextStep}
        </p>
      </div>
      {u.kind === "STATUS_CHANGE" ? (
        <ClientEmail u={u} tab={tab} />
      ) : u.kind === "DOCUMENT" && u.request ? (
        <p className="text-sm">
          <Link href={`/firm/documents/requests/${u.request.id}`} className="font-medium text-[var(--accent)] hover:underline">
            Review the request
          </Link>
          <span className="text-[var(--muted)]"> · completing the request also closes this.</span>
        </p>
      ) : u.kind === "TASK" && u.task ? (
        <p className="text-sm">
          <Link href={`/firm/tasks/${u.task.id}`} className="font-medium text-[var(--accent)] hover:underline">
            Open the task
          </Link>
          <span className="text-[var(--muted)]"> · finishing the task also closes this.</span>
        </p>
      ) : u.kind === "DEADLINE" && u.case ? (
        <p className="text-sm">
          <Link href={`/firm/cases/${u.case.id}#deadlines-h`} className="font-medium text-[var(--accent)] hover:underline">
            Open the case&apos;s deadlines
          </Link>
          <span className="text-[var(--muted)]"> · marking the deadline done also closes this.</span>
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">This closes by itself when USCIS changes the case.</p>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
        <form action={updateAction} className="flex items-end gap-2">
          <Hidden id={u.id} tab={tab} type="assign" />
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Assigned to
            <select name="assigneeId" defaultValue={u.assignedTo?.id ?? ""} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]">
              <option value="">Nobody</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            Assign
          </button>
        </form>
        {u.state !== "DONE" && (
          <form action={updateAction} className="flex items-center gap-1">
            <Hidden id={u.id} tab={tab} type="snooze" />
            <span className="mr-1 text-xs font-medium text-[var(--muted)]">Snooze</span>
            {SNOOZE_DAYS.map((d) => (
              <button key={d} type="submit" name="days" value={d} className={btn}>
                {d === 7 ? "1 week" : `${d} day${d === 1 ? "" : "s"}`}
              </button>
            ))}
          </form>
        )}
        <form action={updateAction} className="ml-auto">
          <Hidden id={u.id} tab={tab} type={u.state === "DONE" || snoozed ? "reopen" : "resolve"} />
          <button type="submit" className={u.state === "DONE" || snoozed ? btn : primary}>
            {u.state === "DONE" ? "Reopen" : snoozed ? "Back to Open" : "Mark done"}
          </button>
        </form>
      </div>
      {(snoozed || u.state === "DONE") && (
        <p className="text-xs text-[var(--muted)]">
          {snoozed ? (
            <>
              Snoozed until <LocalTime iso={u.snoozedUntil!.toISOString()} />
            </>
          ) : (
            <>
              Done <LocalTime iso={u.resolvedAt?.toISOString() ?? null} />
              {who(u.resolvedBy) ? ` by ${who(u.resolvedBy)}` : ""}
            </>
          )}
        </p>
      )}
    </li>
  );
}

export default async function UpdatesPage({ searchParams }: PageProps<"/firm/updates">) {
  const user = await requireUser("/firm/updates");
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" && sp.tab in UPDATES_TABS ? sp.tab : "open") as UpdatesTab;
  const data = await firmUpdateService().list(user.id, tab);
  if (!data) redirect("/firm");
  const { ctx, counts, members, items } = data;
  const isManager = ctx.membership.role !== "STAFF";
  const done = typeof sp.done === "string" ? DONE[sp.done] : undefined;
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? ERRORS.invalid) : undefined;
  const count = (t: UpdatesTab) => (t === "open" ? counts.open : t === "mine" ? counts.mine : t === "snoozed" ? counts.snoozed : null);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Updates</h1>
          <p className="text-sm text-[var(--muted)]">USCIS status changes, stuck cases, deadline reminders and task updates, in one place. Assign it, snooze it, or mark it done.</p>
        </div>
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm">
          Client emails: <strong>{CLIENT_UPDATE_MODES[ctx.firm.clientUpdates].label}</strong>
          {isManager && (
            <>
              {" · "}
              <Link href="/firm/updates/settings" className="font-medium text-[var(--accent)] hover:underline">
                Change
              </Link>
            </>
          )}
        </p>
      </div>
      {done && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <nav aria-label="Update lists" className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
        {(Object.keys(UPDATES_TABS) as UpdatesTab[]).map((t) => (
          <Link
            key={t}
            href={t === "open" ? "/firm/updates" : `/firm/updates?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-semibold ${t === tab ? "bg-[var(--surface)] shadow-[var(--shadow)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {UPDATES_TABS[t]}
            {count(t) !== null && <span className="ml-1.5 tabular-nums">{count(t)}</span>}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          {tab === "open" ? "Nothing waiting. New status changes, stuck cases and deadline reminders show up here." : tab === "mine" ? "Nothing assigned to you right now." : tab === "snoozed" ? "Nothing snoozed." : "Nothing marked done yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((u) => (
            <UpdateCard key={u.id} u={u} tab={tab} members={members} />
          ))}
        </ul>
      )}
    </div>
  );
}
