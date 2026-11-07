import type { Metadata } from "next";
import Link from "next/link";
import { CourtGuide } from "@/components/my-cases-ui";

export const metadata: Metadata = {
  title: "Immigration court (EOIR): how to check your court case · CasePingo",
  description:
    "How to check an immigration court case with your A-Number: EOIR's official case information site and phone line, changing your address with the court, and finding free legal help.",
  alternates: { canonical: "/immigration-court" },
};

export default function ImmigrationCourtPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/resources" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Resources
        </Link>
      </nav>
      <CourtGuide headingLevel={1} />
    </div>
  );
}
