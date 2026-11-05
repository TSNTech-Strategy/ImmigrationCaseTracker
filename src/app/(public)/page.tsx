import Link from "next/link";
import { Suspense } from "react";
import { QueryNotice } from "@/components/query-notice";
import { SITE } from "@/lib/site";

const NOTICES: Record<string, string> = {
  "account-deleted": "Your account and all of your case data have been deleted.",
};

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-14">
      <Suspense fallback={null}>
        <QueryNotice messages={NOTICES} />
      </Suspense>
      <section className="flex max-w-2xl flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-red-text)]">{SITE.tagline}</p>
        <h1 className="text-4xl font-semibold tracking-tight">Your USCIS case. We&apos;ll ping you when it moves.</h1>
        <p className="text-lg leading-relaxed">
          Track the receipt numbers you&apos;re authorized to follow, see their status and history in one place, and get told when
          something changes. For individuals, families and immigration law firms.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--accent-fg)]">
            Create a free account
          </Link>
          <Link href="/how-it-works" className="rounded-md border border-[var(--border)] px-4 py-2.5 font-medium">
            How it works
          </Link>
        </div>
      </section>

      <section aria-label="Highlights" className="grid gap-4 sm:grid-cols-3">
        {[
          ["All your cases together", "Status, form type and history for each receipt number, in English or Spanish."],
          ["Know what changed, and when", "We show when we last checked and when we last saw a change, separately."],
          ["Private by design", "Receipt numbers are encrypted. We never sell your data, and you can delete everything at any time."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{text}</p>
          </div>
        ))}
      </section>

      <p className="max-w-2xl text-sm text-[var(--muted)]">
        {SITE.disclaimer} USCIS is the authoritative source for case status:{" "}
        <a href={SITE.uscisStatusUrl} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
          USCIS Case Status Online
        </a>
        .
      </p>
    </div>
  );
}
