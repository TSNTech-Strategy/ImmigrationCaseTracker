import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { ROLE_LABELS } from "@/lib/firms/roles";
import { InviteForm, MemberControls, RevokeInviteButton } from "../forms";

export const metadata: Metadata = { title: "Team · CasePingo" };

export default async function TeamPage() {
  const user = await requireUser("/firm/team");
  const team = await firmService().listTeam(user.id);
  if (!team) redirect("/firm");
  const { ctx, members, invitations } = team;
  const myRole = ctx.membership.role;
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/firm" className="text-sm underline underline-offset-2">
          ← {ctx.firm.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
      </div>

      <section aria-labelledby="members-h" className="flex flex-col gap-3">
        <h2 id="members-h" className="text-lg font-semibold">
          Members
        </h2>
        <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {members.map((m) => {
            const isSelf = m.userId === user.id;
            const canRemove = isSelf || myRole === "OWNER" || (myRole === "ADMIN" && m.role === "STAFF");
            return (
              <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {m.user.name ?? m.user.email}
                    {isSelf && <span className="text-sm font-normal text-[var(--muted)]"> (you)</span>}
                  </p>
                  {m.user.name && <p className="text-sm text-[var(--muted)]">{m.user.email}</p>}
                </div>
                <MemberControls
                  membershipId={m.id}
                  role={m.role}
                  canChangeRole={myRole === "OWNER"}
                  canRemove={canRemove}
                  isSelf={isSelf}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section aria-labelledby="invite-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 id="invite-h" className="text-lg font-semibold">
            Invite someone
          </h2>
          <p className="text-sm text-[var(--muted)]">
            They&apos;ll get an email with a link that works once and expires in 7 days. They must sign in with the same
            email to accept.
          </p>
          <InviteForm canInviteAdmin={myRole === "OWNER" || myRole === "ADMIN"} />
        </section>
      )}

      {canManage && invitations.length > 0 && (
        <section aria-labelledby="pending-h" className="flex flex-col gap-3">
          <h2 id="pending-h" className="text-lg font-semibold">
            Pending invitations
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{i.email}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {ROLE_LABELS[i.role]} · expires <LocalTime iso={i.expiresAt.toISOString()} />
                  </p>
                </div>
                <RevokeInviteButton invitationId={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm text-[var(--muted)]">
        <h2 className="font-medium text-[var(--foreground)]">What each role can do</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Owner: everything, including changing roles.</li>
          <li>Admin: invite people and remove Staff.</li>
          <li>Staff: work on the firm&apos;s cases.</li>
        </ul>
      </section>
    </div>
  );
}
