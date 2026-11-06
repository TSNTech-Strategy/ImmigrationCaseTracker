import type { Metadata } from "next";
import { CivicsQuestionList } from "@/components/civics-list";
import { CivicsPractice } from "@/components/civics-practice";
import { CIVICS_TEXT } from "@/lib/civics";

export const metadata: Metadata = { title: "Civics test practice · CasePingo" };

/** Civics test practice for signed-in people: the same quiz as the public page, inside the app. */
export default function CivicsPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Civics test practice</h1>
        <p className="text-sm text-[var(--muted)]">USCIS&apos;s official questions, with the real pass and fail rules.</p>
      </div>
      <CivicsPractice />
      <CivicsQuestionList />
      <p className="text-xs text-[var(--muted)]">{CIVICS_TEXT.disclaimer.en}</p>
    </>
  );
}
