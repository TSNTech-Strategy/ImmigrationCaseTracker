import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/form";
import { safeNextPath } from "@/lib/auth/paths";
import { getSessionState } from "@/lib/auth/session";
import { SITE } from "@/lib/site";
import { acceptLegalAction } from "./actions";

// Depends on the signed-in user, so it renders per request.
export const instant = false;

export const metadata: Metadata = { title: "Updated Terms and Privacy Policy · CasePingo" };

/** Active consent to a material change in the Terms or Privacy Policy (requireUser sends users here). */
export default async function AcceptLegalPage({ searchParams }: PageProps<"/legal/accept">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const s = await getSessionState();
  if (s.state === "none") redirect(`/login?next=${encodeURIComponent(`/legal/accept?next=${next}`)}`);
  if (s.state === "mfa_required") redirect("/login/mfa");
  if (s.user.legalAccepted) redirect(next);

  return (
    <AuthShell title="We've updated our Terms and Privacy Policy">
      <p className="text-[var(--muted)]">Here&apos;s what changed, in plain language:</p>
      <ul className="flex flex-col gap-2 pl-5 [&_li]:list-disc">
        {SITE.legalChanges.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p>
        Please read the full <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link> (updated {SITE.legalUpdated}).
      </p>
      <form action={acceptLegalAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <SubmitButton pendingText="Saving…">I accept the updated Terms and Privacy Policy</SubmitButton>
      </form>
      <p className="text-sm text-[var(--muted)]">
        Don&apos;t agree? You can <Link href="/settings#delete-h" className="underline underline-offset-2">delete your account</Link> in Settings
        instead.
      </p>
    </AuthShell>
  );
}
