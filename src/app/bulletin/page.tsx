import type { Metadata } from "next";
import Link from "next/link";
import { BulletinWatchForm } from "@/app/settings/forms";
import { BULLETIN_CHARTS, BulletinChart, BulletinLegend, MoveNote } from "@/components/bulletin-chart";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { visaBulletinService } from "@/lib/visa-bulletin";
import { AREA_LABEL, categoryInfo, chartKey } from "@/lib/visa-bulletin/model";
import { bulletinView, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "@/lib/visa-bulletin/view";

export const metadata: Metadata = { title: "Visa Bulletin · CasePingo" };

/**
 * The Visa Bulletin for every signed-in person, whatever their plan: their own
 * category and country first (both charts and how they moved), then the full
 * charts with their row marked. Following a category is free; alerts are Premium.
 */
export default async function BulletinPage() {
  const user = await requireUser("/bulletin");
  const svc = visaBulletinService();
  const [{ current, previous }, watch, account] = await Promise.all([
    svc.latest(),
    svc.getWatch(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } }),
  ]);
  const alerts = account ? PLAN_LIMITS[account.plan].alerts : false;
  const view = current ? bulletinView(current, previous) : null;
  const info = watch ? categoryInfo(watch.category) : null;
  const mine = watch && info ? { category: watch.category, area: watch.area } : null;
  // Their own kind of category (family or employment) first.
  const charts = info?.kind === "employment" ? [...BULLETIN_CHARTS.slice(2), ...BULLETIN_CHARTS.slice(0, 2)] : BULLETIN_CHARTS;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Visa Bulletin</h1>
        {view ? (
          <p className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">{view.label.en} bulletin</span> ·{" "}
            <a href={view.sourceUrl ?? STATE_BULLETIN_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Official bulletin
            </a>{" "}
            ·{" "}
            <a href={USCIS_CHARTS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Which chart USCIS uses this month
            </a>
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">Green card cut-off dates from the U.S. Department of State, every month.</p>
        )}
      </div>

      <section aria-labelledby="mine-h" className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {watch && info ? (
          <>
            <h2 id="mine-h" className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Your category
            </h2>
            <div>
              <p className="text-2xl font-bold tracking-tight">{info.code}</p>
              <p className="text-[var(--muted)]">{info.en}</p>
              <p className="text-sm">{AREA_LABEL[watch.area].en}</p>
            </div>
            {view ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["final", "filing"] as const).map((type) => {
                  const cell = view.rows[chartKey(info.kind, type)]?.find((r) => r.category === watch.category)?.cells[watch.area];
                  const first = type === watch.chart;
                  return (
                    <div key={type} className={`flex flex-col gap-0.5 rounded-lg p-4 ${first ? "bg-[var(--accent-soft)]" : "bg-[var(--surface-2)]"}`}>
                      <span className="text-sm text-[var(--muted)]">{type === "final" ? "Final action date" : "Date for filing"}</span>
                      <span className="text-xl font-bold tabular-nums">{cell?.value.en ?? "—"}</span>
                      {cell?.move && <MoveNote move={cell.move} className="text-sm font-medium" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">This month&apos;s bulletin isn&apos;t loaded yet. Your dates will show here as soon as it is.</p>
            )}
            <p className="text-sm text-[var(--muted)]">
              {alerts ? (
                "We email you (and notify the app) when these dates move."
              ) : (
                <>
                  Premium emails you when these dates move.{" "}
                  <Link href="/settings#plan-h" className="font-semibold text-[var(--accent)] hover:underline">
                    Get alerts
                  </Link>
                </>
              )}
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Change category</summary>
              <div className="mt-4">
                <BulletinWatchForm watch={watch} alerts={alerts} note={false} />
              </div>
            </details>
          </>
        ) : (
          <>
            <h2 id="mine-h" className="text-xl font-semibold">
              Follow your priority date
            </h2>
            <p className="text-[var(--muted)]">
              Choose your green card category and country to see your dates first, and how they moved since last month.
            </p>
            <BulletinWatchForm watch={null} alerts={alerts} />
          </>
        )}
      </section>

      {view ? (
        <>
          <div className="flex flex-col gap-1">
            {view.previousMonth && <BulletinLegend previousMonth={view.previousMonth} />}
            <p className="text-sm text-[var(--muted)] sm:hidden">Swipe a table sideways to see every country.</p>
          </div>
          {charts.map((ch) =>
            view.rows[ch.key] ? (
              <BulletinChart key={ch.key} id={`chart-${ch.key}`} title={ch.title} note={ch.note} rows={view.rows[ch.key]!} compact mine={mine} />
            ) : null,
          )}
        </>
      ) : (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">This month&apos;s bulletin isn&apos;t loaded yet. Check back soon.</p>
      )}

      <p className="text-xs text-[var(--muted)]">
        From the U.S. Department of State&apos;s Visa Bulletin; always check the{" "}
        <a href={STATE_BULLETIN_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          official bulletin
        </a>{" "}
        and{" "}
        <a href={USCIS_CHARTS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          USCIS&apos;s chart for the month
        </a>{" "}
        before you act. General information, not legal advice.
      </p>
    </>
  );
}
