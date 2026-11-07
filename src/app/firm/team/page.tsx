import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { requireUser } from "@/lib/auth/session";
import { firmService, firmTeamService } from "@/lib/firms";
import { TITLES } from "@/lib/firms/team";
import { formatDue } from "@/lib/firms/alerts";
import { PersonCell, td, th } from "@/components/workspace-ui";
import { ROLE_LABELS } from "@/lib/firms/roles";
import { InviteForm, MemberControls, RevokeInviteButton, TitleControl } from "../forms";

export const metadata: Metadata = { title: "Team · CasePingo" };

export default async function TeamPage() {
  const user = await requireUser("/firm/team");
  const [team, roster] = await Promise.all([firmService().listTeam(user.id), firmTeamService().people(user.id)]);
  if (!team || !roster) redirect("/firm");
  const { ctx, invitations } = team;
  const people = roster.members;
  const myRole = ctx.membership.role;
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-[var(--muted)]">Who&apos;s in {ctx.firm.name}, what they work on, and what they can do.</p>
      </div>

      <section aria-labelledby="members-h" className="flex flex-col gap-3">
        <h2 id="members-h" className="text-lg font-semibold">
          Members <span className="text-sm font-normal text-[var(--muted)]">({people.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className={th}>Member</th>
                <th className={th}>Title</th>
                <th className={`${th} text-right`}>Cases</th>
                <th className={`${th} text-right`}>Inbox</th>
                <th className={th}>Last active</th>
                <th className={th}>Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {people.map((m) => {
                const isSelf = m.userId === user.id;
                const canRemove = isSelf || myRole === "OWNER" || (myRole === "ADMIN" && m.role === "STAFF");
                return (
                  <tr key={m.id} className="align-top">
                    <td className={td}>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          <PersonCell person={{ name: m.hasName ? m.name : null, email: m.email }} />
                          {isSelf && <span className="text-xs font-normal text-[var(--muted)]"> (you)</span>}
                        </span>
                        {m.hasName && <span className="pl-[30px] text-xs text-[var(--muted)]">{m.email}</span>}
                        {m.away && (
                          <span className="pl-[30px] text-xs font-medium text-[var(--st-action)]">
                            Away until {formatDue(m.away.until)}
                            {m.away.backup ? ` · ${m.away.backup} covers` : ""}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={td}>{canManage ? <TitleControl membershipId={m.id} title={m.title ?? ""} titles={TITLES} /> : m.title ? TITLES[m.title] : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      <Link href={`/firm/cases?assignee=${m.userId}`} className="hover:underline">
                        {m.cases.toLocaleString("en-US")}
                      </Link>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{m.openItems.toLocaleString("en-US")}</td>
                    <td className={`${td} whitespace-nowrap text-[var(--muted)]`}>{m.lastActiveAt ? <LocalTime iso={m.lastActiveAt.toISOString()} /> : "Not yet"}</td>
                    <td className={td}>
                      <MemberControls membershipId={m.id} role={m.role} canChangeRole={myRole === "OWNER"} canRemove={canRemove} isSelf={isSelf} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)]">Titles are labels for your team; roles decide what each person can do. Each person sets their own notifications and time away in Settings › My notifications.</p>
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
