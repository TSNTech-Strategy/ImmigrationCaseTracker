import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmService } from "@/lib/firms";
import { TRIAL_CASE_LIMIT, TRIAL_DAYS } from "@/lib/firms/service";
import { FIRM_PLANS } from "@/lib/plans";
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
  if (days <= 0) return "Your free trial has ended, so your firm's cases aren't being checked. An Owner can choose a plan in Billing.";
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
  const trial = ctx.firm.plan ? `Plan: ${FIRM_PLANS[ctx.firm.plan].label}.` : trialText(ctx.firm.trialEndsAt, new Date());
  const n = await firmCaseService().counts(ctx);
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
        <Stat label="Cases tracked" value={`${n.cases} of ${ctx.firm.caseLimit}`} href="/firm/cases" />
        <Stat label="Active clients" value={String(n.clients)} href="/firm/clients" />
        <Stat label="Team members" value={String(members.length)} href="/firm/team" note={invitations.length ? `${invitations.length} invitation${invitations.length === 1 ? "" : "s"} pending` : undefined} />
      </dl>
      {n.unconsented > 0 && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {n.unconsented} case{n.unconsented === 1 ? " has" : "s have"} no active consent and {n.unconsented === 1 ? "isn't" : "aren't"} being checked.{" "}
          <Link href="/firm/cases" className="underline underline-offset-2">
            Review cases
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href="/firm/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Add a case
        </Link>
        <Link href="/firm/clients" className="rounded-md border border-[var(--border)] px-4 py-2 font-medium">
          Add a client
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, href, note }: { label: string; value: string; href: string; note?: string }) {
  // dl > div > dt/dd stays valid HTML; the link covers the whole card.
  return (
    <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 focus-within:border-[var(--accent)] hover:border-[var(--accent)]">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="text-2xl font-semibold">
        <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
          {value}
        </Link>
      </dd>
      {note && <dd className="text-xs text-[var(--muted)]">{note}</dd>}
    </div>
  );
}
