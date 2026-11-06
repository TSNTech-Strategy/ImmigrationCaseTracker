import Link from "next/link";
import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { requireAdminPage } from "@/lib/admin";
import { visaBulletinService } from "@/lib/visa-bulletin";
import { monthLabel } from "@/lib/visa-bulletin/model";
import { BulletinImportForm } from "./import-form";

export const metadata: Metadata = { title: "Visa Bulletin · Admin · CasePingo", robots: { index: false } };

export default async function AdminVisaBulletinPage() {
  const { ready } = await requireAdminPage();
  if (!ready) {
    return (
      <p className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] p-5">
        Turn on two-factor sign-in in <Link href="/settings#security-h" className="underline underline-offset-2">Settings</Link> to import bulletins.
      </p>
    );
  }
  const months = await visaBulletinService().months();
  return (
    <>
      <Link href="/admin" className="text-sm underline underline-offset-2">
        ← Admin
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Visa Bulletin</h1>
      <section className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm leading-relaxed">
        <h2 className="font-semibold">Each month (about 2 minutes)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open the new bulletin from the{" "}
            <a href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              State Department&apos;s Visa Bulletin page
            </a>
            .
          </li>
          <li>Open its page source (right-click → View Page Source, or Ctrl+U / ⌥⌘U), select all and copy. Copying the visible page also works.</li>
          <li>Paste it below with the bulletin&apos;s link, press Preview, compare a few values with the page, then Save.</li>
        </ol>
        <p className="text-[var(--muted)]">
          Saving the newest month alerts Premium people whose category moved, by email and phone notification, once per month. The site blocks automated
          downloads, which is why this step is manual.
        </p>
      </section>
      <BulletinImportForm />
      <section aria-labelledby="vb-months-h" className="flex flex-col gap-2">
        <h2 id="vb-months-h" className="text-lg font-semibold">
          Imported
        </h2>
        {months.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm">
            {months.map((m) => (
              <li key={m.month} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="font-medium">{monthLabel(m.month)}</span>
                <span className="text-[var(--muted)]">
                  Imported <LocalTime iso={m.importedAt.toISOString()} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
