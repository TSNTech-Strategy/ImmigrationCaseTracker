import type { Metadata } from "next";
import Link from "next/link";
import { statusDotClass } from "@/components/status-badge";
import type { StatusCategory } from "@/lib/status-category";
import { STATUS_GUIDE, guideCategory, guideHeading, guidePath } from "@/lib/status-guide";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "What your USCIS case status means · CasePingo",
  description:
    "Plain-language explanations of common USCIS case statuses: what each one means, what usually happens next, and what you can do. In English and Spanish.",
  alternates: { canonical: "/status-guide" },
};

const GROUPS: { cat: StatusCategory; title: string; blurb: string }[] = [
  { cat: "progress", title: "In progress", blurb: "USCIS has the case and is working through it." },
  { cat: "action", title: "Action may be needed", blurb: "Usually a letter, an appointment or a deadline to watch for." },
  { cat: "done", title: "Approved, and what follows", blurb: "Approvals, cards, documents and oath ceremonies." },
  { cat: "stop", title: "Decisions and returned mail", blurb: "Denials, rejections, withdrawals and mail that didn't arrive." },
];

export default function StatusGuideIndex() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <p className="text-sm font-semibold text-[var(--brand-red-text)]">Status guide</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What your USCIS case status means</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        USCIS status wording is short and formal. Here&apos;s what the common statuses usually mean, what tends to happen next, and
        what you can do about it.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
        General information, not legal advice. Your notice and the official USCIS description always come first.
      </p>

      {GROUPS.map((group) => {
        const entries = STATUS_GUIDE.filter((g) => guideCategory(g) === group.cat);
        if (entries.length === 0) return null;
        return (
          <section key={group.cat} aria-labelledby={`g-${group.cat}`} className="mt-12">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(entries[0].title)}`} aria-hidden="true" />
              <h2 id={`g-${group.cat}`} className="text-xl font-semibold">
                {group.title}
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{group.blurb}</p>
            <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {entries.map((g) => (
                <li key={g.slug}>
                  <Link href={guidePath(g)} className="flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-[var(--surface-2)]">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{guideHeading(g)}</span>
                      <span className="text-sm text-[var(--muted)]">{g.meaning.en}</span>
                    </span>
                    <span aria-hidden="true" className="mt-0.5 text-[var(--muted)]">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <aside className="mt-14 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold">Get told when your status changes</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            CasePingo checks your case with USCIS and shows this explanation next to the official wording.
          </p>
        </div>
        <Link href="/signup" className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
          Start free
        </Link>
      </aside>
      <p className="mt-8 text-xs text-[var(--muted)]">
        Status names are USCIS&apos;s public wording. For your official status, use{" "}
        <a href={SITE.uscisStatusUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          USCIS Case Status Online
        </a>
        .
      </p>
    </div>
  );
}
