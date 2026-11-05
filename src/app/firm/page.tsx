import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "@/lib/firms/service";
import { ROLE_LABELS } from "@/lib/firms/roles";
import { CreateFirmForm } from "./forms";

export const metadata: Metadata = { title: "Firm · CasePingo" };

const NOTICES: Record<string, string> = {
  created: "Your firm workspace is ready. Your free trial has started.",
  joined: "You've joined the firm.",
};

function trialText(trialEndsAt: Date | null, now: Date) {
  if (!trialEndsAt) return null;
  const days = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Your free trial has ended. Paid plans are coming soon; your cases keep their current limits until then.";
  return `Free trial: ${days} day${days === 1 ? "" : "s"} left.`;
}

export default async function FirmPage({ searchParams }: PageProps<"/firm">) {
  const user = await requireUser("/firm");
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const team = await firmService().listTeam(user.id);

  if (!team) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">CasePingo Pro for law firms</h1>
        <p className="text-[var(--muted)]">
          Track your clients&apos; USCIS cases as a team. Invite attorneys and staff, give each person the right role,
          and keep a record of every change.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{TRIAL_DAYS}-day free trial, up to {TRIAL_CASE_LIMIT} cases. No card needed.</li>
          <li>Roles: Owner, Admin and Staff.</li>
          <li>Your personal cases stay private and separate from the firm.</li>
        </ul>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-4 text-lg font-semibold">Create your firm workspace</h2>
          <CreateFirmForm />
        </section>
      </>
    );
  }

  const { ctx, members, invitations } = team;
  const trial = trialText(ctx.firm.trialEndsAt, new Date());
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--muted)]">CasePingo Pro</p>
        <h1 className="text-2xl font-semibold tracking-tight">{ctx.firm.name}</h1>
        <p className="text-sm text-[var(--muted)]">Your role: {ROLE_LABELS[ctx.membership.role]}</p>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      {trial && <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">{trial}</p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <dt className="text-sm text-[var(--muted)]">Team members</dt>
          <dd className="text-2xl font-semibold">{members.length}</dd>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <dt className="text-sm text-[var(--muted)]">Pending invitations</dt>
          <dd className="text-2xl font-semibold">{invitations.length}</dd>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <dt className="text-sm text-[var(--muted)]">Case limit</dt>
          <dd className="text-2xl font-semibold">{ctx.firm.caseLimit}</dd>
        </div>
      </dl>
      <div>
        <Link href="/firm/team" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Manage team
        </Link>
      </div>
      <p className="text-sm text-[var(--muted)]">Client and case tracking for your firm are coming next.</p>
    </>
  );
}
