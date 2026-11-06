import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BULLETIN_CHARTS, BulletinChart, BulletinLegend } from "@/components/bulletin-chart";
import { getCurrentUser } from "@/lib/auth/session";
import { visaBulletinService } from "@/lib/visa-bulletin";
import { bulletinView, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "@/lib/visa-bulletin/view";

export const metadata: Metadata = {
  title: "Visa Bulletin: final action dates and dates for filing · CasePingo",
  description:
    "This month's Visa Bulletin cut-off dates for family and employment green card categories, with how each date moved since last month. Get an alert when your category moves.",
  alternates: { canonical: "/visa-bulletin" },
};

/** Signed-in visitors get the same bulletin on their own page, with their category first. */
function SignedInNote() {
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
      <span>You&apos;re signed in: see the bulletin with your own category first.</span>
      <Link href="/bulletin" className="font-semibold text-[var(--accent)] hover:underline">
        Open my Visa Bulletin →
      </Link>
    </p>
  );
}

async function LatestBulletin() {
  await connection();
  const signedIn = (await getCurrentUser().catch(() => null)) ? <SignedInNote /> : null;
  let latest;
  try {
    latest = await visaBulletinService().latest();
  } catch {
    return (
      <>
        {signedIn}
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">The bulletin couldn&apos;t be loaded right now. Please try again shortly.</p>
      </>
    );
  }
  if (!latest.current) {
    return (
      <>
        {signedIn}
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">This month&apos;s bulletin isn&apos;t loaded yet. Check back soon.</p>
      </>
    );
  }
  const view = bulletinView(latest.current, latest.previous);
  return (
    <>
      {signedIn}
      <div className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        <p>
          <span className="font-semibold text-[var(--foreground)]">{view.label.en} bulletin</span> ·{" "}
          <a href={view.sourceUrl ?? STATE_BULLETIN_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Official bulletin
          </a>
        </p>
        {view.previousMonth && <BulletinLegend previousMonth={view.previousMonth} />}
        <p className="sm:hidden">Swipe a table sideways to see every country.</p>
      </div>
      {BULLETIN_CHARTS.map((ch) =>
        view.rows[ch.key] ? <BulletinChart key={ch.key} id={`chart-${ch.key}`} title={ch.title} note={ch.note} rows={view.rows[ch.key]!} /> : null,
      )}
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
