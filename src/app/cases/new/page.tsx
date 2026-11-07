import Link from "next/link";
import type { Metadata } from "next";
import { ModeBanner } from "@/components/mode-banner";
import { CONSENT_FOOTNOTE, INDIVIDUAL_CONSENT_OPTIONS } from "@/lib/cases/consent";
import { getUscisClient } from "@/lib/uscis";
import { AddCaseForm } from "./add-case-form";

export const metadata: Metadata = { title: "Add a case · CasePingo" };

export default function NewCasePage() {
  return (
    <>
      <Link href="/cases" className="text-sm underline underline-offset-2">
        ← My cases
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a case</h1>
      <ModeBanner mode={getUscisClient().mode} />
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <AddCaseForm options={INDIVIDUAL_CONSENT_OPTIONS} footnote={CONSENT_FOOTNOTE} />
      </div>
      <Link
        href="/checklists"
        className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
      >
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6h11M9 12h11M9 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="font-semibold">Haven&apos;t filed yet?</span>
            <span className="text-sm text-[var(--muted)]">See which documents to gather for your case type.</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </>
  );
}
