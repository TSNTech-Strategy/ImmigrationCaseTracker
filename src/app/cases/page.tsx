import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "@/app/(auth)/actions";

// Depends on the signed-in user / request, so it renders per request
// (Cache Components: allowed to block instead of prerendering a shell).
export const instant = false;

export const metadata: Metadata = { title: "My cases · ImmigrationCaseTracker" };

const NOTICES: Record<string, string> = { "password-updated": "Your password was updated." };

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await requireUser("/cases");
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <form action={signOutAction}>
          <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
            Sign out
          </button>
        </form>
      </header>
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      <p>
        Signed in as <strong>{user.name ?? user.email}</strong> ({user.email}).
      </p>
      <p className="text-[var(--muted)]">Case tracking arrives in the next step.</p>
    </main>
  );
}
