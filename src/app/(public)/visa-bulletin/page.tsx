import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { visaBulletinService } from "@/lib/visa-bulletin";
import { AREA_LABEL, AREAS, type ChartKey, monthLabel } from "@/lib/visa-bulletin/model";
import { bulletinView, STATE_BULLETIN_URL, USCIS_CHARTS_URL, type ViewRow } from "@/lib/visa-bulletin/view";

export const metadata: Metadata = {
  title: "Visa Bulletin: final action dates and dates for filing · CasePingo",
  description:
    "This month's Visa Bulletin cut-off dates for family and employment green card categories, with how each date moved since last month. Get an alert when your category moves.",
  alternates: { canonical: "/visa-bulletin" },
};

const CHARTS: { key: ChartKey; title: string; note: string }[] = [
  { key: "familyFinal", title: "Family-sponsored: final action dates", note: "When a green card can be issued." },
  { key: "familyFiling", title: "Family-sponsored: dates for filing", note: "When you may submit your application, if USCIS accepts this chart this month." },
  { key: "employmentFinal", title: "Employment-based: final action dates", note: "When a green card can be issued." },
  { key: "employmentFiling", title: "Employment-based: dates for filing", note: "When you may submit your application, if USCIS accepts this chart this month." },
];

function ChartTable({ id, title, note, rows }: { id: string; title: string; note: string; rows: ViewRow[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <p className="text-sm text-[var(--muted)]">{note}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[700px] table-fixed text-left text-sm sm:min-w-[760px]">
          <colgroup>
            <col className="w-24 sm:w-[28%]" />
            {AREAS.map((a) => (
              <col key={a} />
            ))}
          </colgroup>
          <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              {/* The category column stays put while the table scrolls sideways on a phone. */}
              <th scope="col" className="sticky left-0 z-10 bg-[var(--surface-2)] px-3 py-2.5 font-medium sm:px-4">
                Category
              </th>
              {AREAS.map((a) => (
                <th key={a} scope="col" className="px-3 py-2.5 font-medium">
                  {AREA_LABEL[a].en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-t border-[var(--border)] align-top">
                <th scope="row" className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2.5 font-normal sm:px-4">
                  <span className="font-semibold">{r.code}</span>
                  <span className="sr-only text-xs text-[var(--muted)] sm:not-sr-only sm:block">{r.en}</span>
                </th>
                {AREAS.map((a) => {
                  const cell = r.cells[a];
                  const tone = cell?.move?.tone;
                  return (
                    <td key={a} className="px-3 py-2.5">
                      <span className="whitespace-nowrap font-medium tabular-nums">{cell?.value.en ?? "—"}</span>
                      {cell?.move?.changed && (
                        <span className={`block text-xs ${tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                          {tone === "good" ? "▲ " : tone === "bad" ? "▼ " : ""}
                          {cell.move.en}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function LatestBulletin() {
  await connection();
  let latest;
  try {
    latest = await visaBulletinService().latest();
  } catch {
    return <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">The bulletin couldn&apos;t be loaded right now. Please try again shortly.</p>;
  }
  if (!latest.current) {
    return <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">This month&apos;s bulletin isn&apos;t loaded yet. Check back soon.</p>;
  }
  const view = bulletinView(latest.current, latest.previous);
  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        <p>
          <span className="font-semibold text-[var(--foreground)]">{view.label.en} bulletin</span> ·{" "}
          <a href={view.sourceUrl ?? STATE_BULLETIN_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Official bulletin
          </a>
        </p>
        {view.previousMonth && (
          <p>
            Changes since {monthLabel(view.previousMonth)}: <span className="text-[var(--success)]">▲ moved ahead</span>,{" "}
            <span className="text-[var(--danger)]">▼ moved back</span>. Dates without a note didn&apos;t change.
          </p>
        )}
        <p className="sm:hidden">Swipe a table sideways to see every country.</p>
      </div>
      {CHARTS.map((ch) => (view.rows[ch.key] ? <ChartTable key={ch.key} id={`chart-${ch.key}`} title={ch.title} note={ch.note} rows={view.rows[ch.key]!} /> : null))}
    </>
  );
}

export default function VisaBulletinPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-red-text)]">Visa Bulletin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This month&apos;s green card cut-off dates</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          The U.S. Department of State publishes the Visa Bulletin every month. If your priority date is earlier than the date shown for your category
          and country, your case can move forward. Each month USCIS says which chart applies to adjustment of status inside the U.S.
        </p>
      </div>
      <Suspense fallback={<p className="text-[var(--muted)]">Loading the latest bulletin…</p>}>
        <LatestBulletin />
      </Suspense>
      <aside className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold">Get told when your date moves</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Pick your category and country in Settings or in the app. Premium alerts you by email and notification each month it moves.</p>
        </div>
        <Link href="/signup" className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
          Start free
        </Link>
      </aside>
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
    </div>
  );
}
