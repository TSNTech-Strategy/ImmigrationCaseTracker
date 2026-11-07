import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmAlertService } from "@/lib/firms";
import { daysUntil } from "@/lib/firms/alerts";
import { DEADLINE_NOTICES, DeadlineList } from "./deadline-list";

export const metadata: Metadata = { title: "Deadlines · CasePingo" };

export default async function DeadlinesPage({ searchParams }: PageProps<"/firm/deadlines">) {
  const user = await requireUser("/firm/deadlines");
  const data = await firmAlertService().firmDeadlines(user.id);
  if (!data) redirect("/firm");
  const { today, open, done } = data;
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? DEADLINE_NOTICES[notice] : undefined;
  const overdue = open.filter((d) => daysUntil(d.dueOn, today) < 0);
  const week = open.filter((d) => daysUntil(d.dueOn, today) >= 0 && daysUntil(d.dueOn, today) <= 7);
  const later = open.filter((d) => daysUntil(d.dueOn, today) > 7);
  const group = (title: string, items: typeof open, id: string, empty?: string) =>
    items.length > 0 || empty ? (
      <section aria-labelledby={id} className="flex flex-col gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title} <span className="text-base font-normal tabular-nums text-[var(--muted)]">{items.length}</span>
        </h2>
        {items.length > 0 ? <DeadlineList items={items} today={today} from="list" /> : <p className="text-sm text-[var(--muted)]">{empty}</p>}
      </section>
    ) : null;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Deadlines</h1>
        <p className="text-sm text-[var(--muted)]">Every open deadline across your firm&apos;s cases. Add them on each case page; reminders arrive in Updates.</p>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      {open.length === 0 && done.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          No deadlines yet. Open a case and add one, like an RFE response date from the notice.
        </p>
      ) : (
        <>
          {group("Overdue", overdue, "overdue-h")}
          {group("Next 7 days", week, "week-h", "Nothing due in the next 7 days.")}
          {group("Later", later, "later-h")}
          {group("Done in the last 30 days", done, "done-h")}
        </>
      )}
    </div>
  );
}
