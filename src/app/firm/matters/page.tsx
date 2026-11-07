import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmMatterService } from "@/lib/firms";
import { MATTER_KINDS } from "@/lib/firms/matters";
import { EmptyState, btn, td, th } from "@/components/workspace-ui";
import { LocalTime } from "@/components/local-time";
import { MatterForm } from "./matter-form";

export const metadata: Metadata = { title: "Matters · CasePingo" };

const KINDS = Object.entries(MATTER_KINDS).map(([value, k]) => ({ value, ...k }));

export default async function MattersPage({ searchParams }: PageProps<"/firm/matters">) {
  const user = await requireUser("/firm/matters");
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const data = await firmMatterService().list(user.id, { archived });
  if (!data) redirect("/firm");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">{archived ? "Archived matters" : "Matters"}</h1>
          <p className="text-sm text-[var(--muted)]">Group related cases: a family&apos;s petitions, an employer&apos;s workers, a lawsuit.</p>
        </div>
        <Link href={archived ? "/firm/matters" : "/firm/matters?archived=1"} className={btn}>
          {archived ? "Active matters" : "Archived"}
        </Link>
      </div>

      {!archived && (
        <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" open={data.matters.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">New matter</summary>
          <div className="mt-4">
            <MatterForm mode="create" initial={{ name: "", kind: "FAMILY", description: "" }} kinds={KINDS} />
          </div>
        </details>
      )}

      {data.matters.length === 0 ? (
        <EmptyState title={archived ? "No archived matters" : "No matters yet"}>{archived ? null : "Create a matter, then add its cases from the matter page or from each case."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th scope="col" className={th}>Matter</th>
                <th scope="col" className={th}>Kind</th>
                <th scope="col" className={`${th} text-right`}>Cases</th>
                <th scope="col" className={`${th} text-right`}>Open tasks</th>
                <th scope="col" className={th}>Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.matters.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--surface-2)]">
                  <td className={td}>
                    <Link href={`/firm/matters/${m.id}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    {m.description && <div className="max-w-md truncate text-xs text-[var(--muted)]">{m.description}</div>}
                  </td>
                  <td className={td}>{MATTER_KINDS[m.kind].label}</td>
                  <td className={`${td} text-right tabular-nums`}>{m._count.cases}</td>
                  <td className={`${td} text-right tabular-nums`}>{m._count.tasks}</td>
                  <td className={`${td} whitespace-nowrap text-[var(--muted)]`}>
                    <LocalTime iso={m.updatedAt.toISOString()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
