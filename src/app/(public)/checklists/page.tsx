import type { Metadata } from "next";
import Link from "next/link";
import { checklistPath, checklistSummaries } from "@/lib/checklists";

export const metadata: Metadata = {
  title: "Document checklists for USCIS applications · CasePingo",
  description: "What to gather before you file: document checklists for the green card, work permit, travel document, family petition, citizenship, DACA, TPS, asylum and more.",
  alternates: { canonical: "/checklists" },
};

export default function ChecklistsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/resources" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Resources
        </Link>
      </nav>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-red-text)]">Document checklists</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What to gather before you apply</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          Pick your case type to see the documents USCIS usually asks for, and tick them off as you gather them. General guidance from the form instructions, not legal advice.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {checklistSummaries().map((c) => (
          <li key={c.key}>
            <Link
              href={checklistPath(c.key)}
              className="flex h-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="self-start rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-sm font-bold text-[var(--accent)]">{c.form}</span>
              <span className="text-lg font-semibold">{c.title.en}</span>
              <span className="text-sm text-[var(--muted)]">{c.summary.en}</span>
              <span className="mt-auto text-sm font-medium">
                {c.required} required documents · {c.total - c.required} if they apply
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
