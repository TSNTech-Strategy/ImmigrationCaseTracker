import Link from "next/link";
import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { adminService, requireAdminPage } from "@/lib/admin";
import { billingEnabled, billingTestMode } from "@/lib/billing";
import { getUscisClient } from "@/lib/uscis";
import { DeletionControls } from "./forms";

export const metadata: Metadata = { title: "Admin · CasePingo", robots: { index: false } };

const ago = (d: Date | null, now: Date) => {
  if (!d) return "never";
  const m = Math.round((now.getTime() - d.getTime()) / 60_000);
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[var(--danger)]" : tone === "ok" ? "text-[var(--success)]" : "";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</dd>
      {note && <dd className="text-xs text-[var(--muted)]">{note}</dd>}
    </div>
  );
}

export default async function AdminPage() {
  const { ready } = await requireAdminPage();
  if (!ready) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] p-5">
          Turn on two-factor sign-in in{" "}
          <Link href="/settings#security-h" className="underline underline-offset-2">
            Settings
          </Link>
          , then sign out and back in, to open the admin page.
        </p>
      </>
    );
  }

  const svc = adminService();
  const [o, deletions] = await Promise.all([svc.overview(), svc.deletionRequests()]);
  const now = new Date();
  const mode = getUscisClient().mode;
  const usedPct = Math.round((o.uscis.usedToday / Math.max(1, o.uscis.budget)) * 100);
  const schedulerQuiet = !o.uscis.lastScheduledAt || now.getTime() - o.uscis.lastScheduledAt.getTime() > 2 * 3600_000;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-[var(--muted)]">
          USCIS: {mode} · Billing: {billingEnabled() ? (billingTestMode() ? "on (test mode)" : "on (live)") : "off"} · Counts only; no receipt numbers or
          client details are shown here.
        </p>
      </div>

      <section aria-labelledby="health-h" className="flex flex-col gap-3">
        <h2 id="health-h" className="text-lg font-semibold">
          Checks and USCIS
        </h2>
        {o.uscis.circuitOpen && (
          <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
            Circuit breaker is on: USCIS calls have been failing in bulk, so scheduled checks are paused until they recover.
          </p>
        )}
        {schedulerQuiet && (
          <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
            No scheduled check has run in the last 2 hours. Check the Inngest app is synced and its functions are running.
          </p>
        )}
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="USCIS calls today (UTC)" value={`${o.uscis.usedToday} / ${o.uscis.budget}`} note={`${usedPct}% of the daily budget`} tone={usedPct >= 90 ? "bad" : undefined} />
          <Tile label="Last successful check" value={ago(o.uscis.lastOkAt, now)} />
          <Tile label="Last scheduled check" value={ago(o.uscis.lastScheduledAt, now)} tone={schedulerQuiet ? "bad" : "ok"} />
          <Tile label="Cases overdue > 1 h" value={String(o.uscis.overdue)} tone={o.uscis.overdue > 0 ? "bad" : "ok"} />
        </dl>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <p className="mb-2 font-medium">Check results, last 24 hours</p>
          {o.uscis.outcomes24h.length === 0 ? (
            <p className="text-[var(--muted)]">No checks in the last 24 hours.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {o.uscis.outcomes24h.map((x) => (
                <li
                  key={x.outcome}
                  className={`rounded-full border px-3 py-1 tabular-nums ${x.outcome === "ok" ? "border-[var(--success)] text-[var(--success)]" : "border-[var(--danger)] text-[var(--danger)]"}`}
                >
                  {x.outcome}: {x.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="alerts-h" className="flex flex-col gap-3">
        <h2 id="alerts-h" className="text-lg font-semibold">
          Email alerts, last 7 days
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Tile label="Sent" value={String(o.notifications.sent7)} />
          <Tile label="Failed" value={String(o.notifications.failed7)} tone={o.notifications.failed7 > 0 ? "bad" : "ok"} />
        </dl>
        {o.notifications.recentFailures.length > 0 && (
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm">
            {o.notifications.recentFailures.map((f) => (
              <li key={f.id} className="flex flex-col gap-0.5 p-3">
                <span>
                  {f.to} · <LocalTime iso={f.at.toISOString()} />
                </span>
                <span className="font-mono text-xs text-[var(--muted)]">{f.error || "No error message"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="people-h" className="flex flex-col gap-3">
        <h2 id="people-h" className="text-lg font-semibold">
          People and plans
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Users" value={String(o.people.users)} note={`${o.people.newUsers} new this week`} />
          <Tile label="Premium" value={String(o.people.premium)} />
          <Tile label="Firms" value={String(o.people.firms)} note={`Solo ${o.people.firmSolo} · Firm ${o.people.firmFirm} · Plus ${o.people.firmPlus} · trial ${o.people.trialFirms} · lapsed ${o.people.lapsedFirms}`} />
          <Tile label="Cases" value={String(o.people.individualCases + o.people.firmCases)} note={`${o.people.individualCases} personal · ${o.people.firmCases} firm · ${o.people.pausedCases} paused`} />
        </dl>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <p className="mb-2 font-medium">Subscriptions</p>
          {o.billing.byStatus.length === 0 ? (
            <p className="text-[var(--muted)]">No subscriptions yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {o.billing.byStatus.map((s) => (
                <li key={s.status} className="rounded-full border border-[var(--border)] px-3 py-1 tabular-nums">
                  {s.status}: {s.count}
                </li>
              ))}
            </ul>
          )}
          {o.billing.pastDue.length > 0 && (
            <>
              <p className="mb-1 mt-3 font-medium text-[var(--danger)]">Payment failed (7-day grace)</p>
              <ul className="flex flex-col gap-1">
                {o.billing.pastDue.map((s) => (
                  <li key={s.id}>
                    {s.who} · {s.product} · since {s.since ? <LocalTime iso={s.since.toISOString()} /> : "unknown"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="del-h" className="flex flex-col gap-3">
        <h2 id="del-h" className="text-lg font-semibold">
          Open deletion requests
        </h2>
        {deletions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">None. Every request has been handled.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {deletions.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium">
                    {d.scope.toLowerCase()} · {d.requesterEmail}
                  </span>
                  <span className="text-[var(--muted)]">
                    Requested <LocalTime iso={d.requestedAt.toISOString()} /> · {d.status.replace("_", " ").toLowerCase()}
                  </span>
                  {d.notes && <span className="text-[var(--danger)]">{d.notes}</span>}
                </div>
                <div className="md:w-[26rem]">
                  <DeletionControls id={d.id} canRetry={d.scope === "ACCOUNT" && Boolean(d.targetId ?? d.requesterId)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
