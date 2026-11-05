import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          {SITE.name}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/how-it-works" className="hover:underline underline-offset-2">How it works</Link>
          <Link href="/pricing" className="hover:underline underline-offset-2">Pricing</Link>
          <Link href="/login" className="hover:underline underline-offset-2">Sign in</Link>
          <Link href="/signup" className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-fg)]">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-8 text-sm text-[var(--muted)]">
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link href="/how-it-works" className="underline underline-offset-2">How it works</Link>
          <Link href="/pricing" className="underline underline-offset-2">Pricing</Link>
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>
          <Link href="/accessibility" className="underline underline-offset-2">Accessibility</Link>
        </nav>
        <p className="text-xs">{SITE.disclaimer}</p>
        <p className="text-xs">© 2026 {SITE.company}</p>
      </div>
    </footer>
  );
}

/** Readable long-form text (legal pages, explainers). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 leading-relaxed [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-2">
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
