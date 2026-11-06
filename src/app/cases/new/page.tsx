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
    </>
  );
}
