import Link from "next/link";
import { prisma } from "@/lib/db";
import { AccountMenu } from "./account-menu";
import { AppNav } from "./app-nav";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

/**
 * Signed-in header. Places on the left (My cases, Visa Bulletin, Civics test, and Firm for firm members),
 * account tools on the right: the theme toggle and an account menu
 * ("Welcome, <name>") holding settings, plan, firm workspace, admin and sign out.
 * On phones the places move to a second row so nothing wraps awkwardly.
 */
export async function AppHeader({ user }: { user: { id: string; name: string | null; email: string; isAdmin: boolean } }) {
  const firmMember = Boolean(await prisma.firmMembership.findFirst({ where: { userId: user.id, revokedAt: null }, select: { id: true } }));
  const places = [
    { href: "/cases", label: "My cases" },
    { href: "/bulletin", label: "Visa Bulletin" },
    { href: "/civics", label: "Civics test" },
    ...(firmMember ? [{ href: "/firm", label: "Firm" }] : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-8 px-4 pt-2.5 sm:pb-0">
        <div className="py-1.5">
          <Logo href="/cases" />
        </div>
        <AppNav items={places} />
        <div className="ml-auto flex items-center gap-2 py-1.5">
          <ThemeToggle />
          <AccountMenu name={user.name} email={user.email} isAdmin={user.isAdmin} firmMember={firmMember} />
        </div>
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
