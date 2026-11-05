import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/cases" className="font-semibold tracking-tight">
          CasePingo
        </Link>
        <nav aria-label="Account" className="flex items-center gap-4 text-sm">
          <Link href="/cases" className="underline-offset-2 hover:underline">
            My cases
          </Link>
          <Link href="/settings" className="underline-offset-2 hover:underline">
            Settings
          </Link>
          <span className="hidden text-[var(--muted)] md:inline">{email}</span>
          <form action={signOutAction}>
            <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-8 text-xs text-[var(--muted)]">
      <nav aria-label="Legal" className="flex flex-wrap gap-4">
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        <Link href="/terms" className="underline underline-offset-2">Terms</Link>
        <Link href="/accessibility" className="underline underline-offset-2">Accessibility</Link>
      </nav>
      <p>
      CasePingo is an independent service, not affiliated with or endorsed by USCIS or DHS, and does not
      provide legal advice. USCIS is the authoritative source for case status:{" "}
      <a href="https://egov.uscis.gov/" className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">
        USCIS Case Status Online
      </a>
      .
      </p>
    </footer>
  );
}
