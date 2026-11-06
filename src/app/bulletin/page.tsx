import type { Metadata } from "next";
import { BulletinDisclaimer, BulletinHowTo, BulletinLinks } from "@/components/bulletin-guide";

export const metadata: Metadata = { title: "Visa Bulletin · CasePingo" };

/** The Visa Bulletin for signed-in people: the official links and how to read them. */
export default function BulletinPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Visa Bulletin</h1>
        <p className="text-sm text-[var(--muted)]">Green card cut-off dates from the U.S. Department of State, every month.</p>
      </div>
      <BulletinLinks />
      <BulletinHowTo />
      <BulletinDisclaimer />
    </>
  );
}
