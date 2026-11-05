import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { ROLE_LABELS } from "@/lib/firms/roles";
import { AcceptInviteForm } from "../../forms";

export const metadata: Metadata = { title: "Firm invitation · CasePingo", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/firm/invite/[token]">) {
  const { token } = await params;
  const user = await requireUser(`/firm/invite/${encodeURIComponent(token)}`);
  const invite = await firmService().previewInvite(token);

  if (!invite) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Invitation not available</h1>
        <p>This invitation is invalid, was cancelled or has expired. Ask your firm to send a new one.</p>
        <Link href="/cases" className="underline underline-offset-2">
          Go to my cases
        </Link>
      </>
    );
  }

  const wrongEmail = user.email.trim().toLowerCase() !== invite.email;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Join {invite.firmName}</h1>
      <p>
        You&apos;ve been invited to join <strong>{invite.firmName}</strong> on CasePingo Pro as{" "}
        <strong>{ROLE_LABELS[invite.role]}</strong>.
      </p>
      {wrongEmail ? (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          This invitation is for {invite.email}, but you&apos;re signed in as {user.email}. Sign out and sign in with{" "}
          {invite.email} to accept it.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">
            Your personal cases stay private. The firm sees only the firm&apos;s cases.
          </p>
          <AcceptInviteForm token={token} />
        </>
      )}
    </>
  );
}
