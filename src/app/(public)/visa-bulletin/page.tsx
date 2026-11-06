import type { Metadata } from "next";
import Link from "next/link";
import { BulletinDisclaimer, BulletinHowTo, BulletinLinks } from "@/components/bulletin-guide";

export const metadata: Metadata = {
  title: "Visa Bulletin: how to check your green card date · CasePingo",
  description:
    "Open this month's Visa Bulletin from the U.S. Department of State and learn how to read it: your priority date, your category, your country's column, and which chart USCIS uses.",
  alternates: { canonical: "/visa-bulletin" },
};

export default function VisaBulletinPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-red-text)]">Visa Bulletin</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Check your green card date</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          Every month the U.S. Department of State publishes the Visa Bulletin. It shows which priority dates can move forward in each family and
          employment category. Here&apos;s where to find it and how to read it.
        </p>
      </div>
      <BulletinLinks />
      <BulletinHowTo />
      <aside className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold">Waiting on a USCIS case?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">CasePingo checks your case for you and tells you when its status changes.</p>
        </div>
        <Link href="/signup" className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
          Start free
        </Link>
      </aside>
      <BulletinDisclaimer />
    </div>
  );
}
