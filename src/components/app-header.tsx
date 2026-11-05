import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ email, isAdmin = false }: { email: string; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo href="/cases" />
        <nav aria-label="Account" className="flex items-center gap-4 text-sm">
          <Link href="/cases" className="underline-offset-2 hover:underline">
            My cases
          </Link>
          <Link href="/firm" className="underline-offset-2 hover:underline">
            Firm
          </Link>
          <Link href="/settings" className="underline-offset-2 hover:underline">
            Settings
          </Link>
          {isAdmin && (
            <Link href="/admin" className="underline-offset-2 hover:underline">
              Admin
            </Link>
          )}
          <span className="hidden text-[var(--muted)] md:inline">{email}</span>
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:bg-[var(--surface-2)]">
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
