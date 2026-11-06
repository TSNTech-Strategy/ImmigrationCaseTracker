import type { Metadata } from "next";
import Link from "next/link";
import { CivicsQuestionList } from "@/components/civics-list";
import { CivicsPractice } from "@/components/civics-practice";
import { CIVICS_TEXT } from "@/lib/civics";

export const metadata: Metadata = {
  title: "U.S. citizenship test practice: official civics questions · CasePingo",
  description:
    "Practice the naturalization civics test with USCIS's official questions: the 2025 test (128 questions) and the 2008 test (100). Mock tests with the real pass and fail rules, practice by section, and every answer.",
  alternates: { canonical: "/civics-test" },
};

export default function CivicsTestPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-red-text)]">Citizenship test</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Practice the civics test</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          The real questions from USCIS&apos;s official lists, with the same pass and fail rules the officer uses. Pick your test, then take a
          mock test or practice one section at a time.
        </p>
      </div>
      <CivicsPractice />
      <CivicsQuestionList />
      <aside className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold">Waiting on your citizenship case?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">CasePingo checks your case for you and tells you when its status changes, like when your interview is scheduled.</p>
        </div>
        <Link href="/signup" className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
          Start free
        </Link>
      </aside>
      <p className="text-xs text-[var(--muted)]">{CIVICS_TEXT.disclaimer.en}</p>
    </div>
  );
}
