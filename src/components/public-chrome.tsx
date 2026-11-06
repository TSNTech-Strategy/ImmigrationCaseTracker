import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/status-guide", label: "Status guide" },
  { href: "/visa-bulletin", label: "Visa Bulletin" },
  { href: "/pricing", label: "Pricing" },
  { href: "/pricing#firms", label: "For law firms" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)] sm:inline-block">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="hidden rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm hover:bg-[var(--accent-hover)] sm:inline-block"
          >
            Start free
          </Link>
          {/* Phone menu: works without JavaScript */}
          <details className="relative md:hidden">
            <summary
              aria-label="Menu"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--border)] [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav
              aria-label="Menu"
              className="absolute right-0 top-11 flex w-56 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-sm font-medium shadow-[var(--shadow)]"
            >
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2.5 hover:bg-[var(--surface-2)]">
                  {n.label}
                </Link>
              ))}
              <Link href="/login" className="rounded-md px-3 py-2.5 hover:bg-[var(--surface-2)]">
                Sign in
              </Link>
              <Link href="/signup" className="mt-1 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-center font-semibold text-[var(--accent-fg)]">
                Start free
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const col = "flex flex-col gap-2 text-sm";
  const link = "text-[var(--muted)] hover:text-[var(--foreground)]";
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-[var(--muted)]">{SITE.tagline}. USCIS case alerts for individuals, families and immigration law firms.</p>
        </div>
        <nav aria-label="Product" className={col}>
          <p className="font-semibold">Product</p>
          <Link href="/how-it-works" className={link}>How it works</Link>
          <Link href="/status-guide" className={link}>Status guide</Link>
          <Link href="/visa-bulletin" className={link}>Visa Bulletin</Link>
          <Link href="/pricing" className={link}>Pricing</Link>
          <Link href="/pricing#firms" className={link}>For law firms</Link>
        </nav>
        <nav aria-label="Account" className={col}>
          <p className="font-semibold">Account</p>
          <Link href="/signup" className={link}>Create account</Link>
          <Link href="/login" className={link}>Sign in</Link>
          <Link href="/settings" className={link}>Settings</Link>
        </nav>
        <nav aria-label="Legal" className={col}>
          <p className="font-semibold">Legal</p>
          <Link href="/privacy" className={link}>Privacy Policy</Link>
          <Link href="/terms" className={link}>Terms of Service</Link>
          <Link href="/accessibility" className={link}>Accessibility</Link>
        </nav>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-[var(--muted)]">
          <p>
            {SITE.disclaimer} USCIS is the authoritative source for case status:{" "}
            <a href={SITE.uscisStatusUrl} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
              USCIS Case Status Online
            </a>
            .
          </p>
          <p>© 2026 {SITE.company}</p>
        </div>
      </div>
    </footer>
  );
}

/** Readable long-form text (legal pages, explainers). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2">
      {children}
    </article>
  );
}

export function DraftNotice() {
  return (
    <p role="note" className="rounded-md border border-dashed border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
      Draft for legal review. This text has not yet been reviewed by an attorney and may change before launch.
    </p>
  );
}
