import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/cases" className="font-semibold tracking-tight">
          ImmigrationCaseTracker
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-[var(--muted)] sm:inline">{email}</span>
          <form action={signOutAction}>
            <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-xs text-[var(--muted)]">
      ImmigrationCaseTracker is an independent service, not affiliated with or endorsed by USCIS or DHS, and does not
      provide legal advice. USCIS is the authoritative source for case status:{" "}
      <a href="https://egov.uscis.gov/" className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">
        USCIS Case Status Online
      </a>
      .
    </footer>
  );
}
