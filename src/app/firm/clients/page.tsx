import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import { COUNTRIES } from "@/lib/firms/profile";
import { EmptyState, btn, btnPrimary, control, td, th } from "@/components/workspace-ui";

export const metadata: Metadata = { title: "Clients · CasePingo" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function ClientsPage({ searchParams }: PageProps<"/firm/clients">) {
  const user = await requireUser("/firm/clients");
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const q = one(sp.q);
  const country = one(sp.country);
  const data = await firmCaseService().listClients(user.id, { archived: showArchived, q, country: country && COUNTRIES.some((c) => c.code === country) ? country : undefined });
  if (!data) redirect("/firm");
  const filtered = Boolean(q || country);
  const used = new Set(data.clients.map((c) => c.countryOfBirth).filter(Boolean));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{showArchived ? "Archived clients" : "Clients"}</h1>
          <span className="text-sm tabular-nums text-[var(--muted)]">{data.clients.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={showArchived ? "/firm/clients" : "/firm/clients?archived=1"} className={btn}>
            {showArchived ? "Active clients" : "Archived"}
          </Link>
          {!showArchived && (
            <Link href="/firm/clients/new" className={btnPrimary}>
              New client
            </Link>
          )}
        </div>
      </div>

      <form method="get" role="search" aria-label="Filter clients" className="grid gap-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <label>
          <span className="sr-only">Search</span>
          <input name="q" type="search" defaultValue={q} placeholder="Search: name, email, phone, reference" className={control} />
        </label>
        <label>
          <span className="sr-only">Country of birth</span>
          <select name="country" defaultValue={country ?? ""} className={control}>
            <option value="">All countries</option>
            {COUNTRIES.filter((c) => used.has(c.code) || c.code === country).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className={btn}>
            Apply
          </button>
          {filtered && (
            <Link href={showArchived ? "/firm/clients?archived=1" : "/firm/clients"} className="px-1 text-sm font-medium text-[var(--accent)] hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {data.clients.length === 0 ? (
        <EmptyState title={filtered ? "No clients match" : showArchived ? "No archived clients" : "Add your first client"}>
          {filtered ? "Try another search." : showArchived ? null : "Clients live on their own, so you can add them early and link receipts as USCIS notices arrive."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Country of birth</th>
                <th scope="col" className={`${th} text-right`}>Cases</th>
                <th scope="col" className={`${th} text-right`}>Needs action</th>
                <th scope="col" className={th}>Email</th>
                <th scope="col" className={th}>Language</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.clients.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                  <td className={td}>
                    <Link href={`/firm/clients/${c.id}`} className="font-medium hover:underline">
                      {c.displayName}
                    </Link>
                    {c.externalRef && <div className="text-xs text-[var(--muted)]">{c.externalRef}</div>}
                  </td>
                  <td className={td}>{c.countryName ?? <span className="text-[var(--muted)]">—</span>}</td>
                  <td className={`${td} text-right tabular-nums`}>{c._count.cases}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {c.needsAction > 0 ? (
                      <Link href="/firm/updates" className="rounded-full bg-[var(--st-action-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--st-action)]">
                        {c.needsAction}
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">0</span>
                    )}
                  </td>
                  <td className={`${td} max-w-[220px] truncate`}>{c.email ?? <span className="text-[var(--muted)]">—</span>}</td>
                  <td className={td}>{c.locale === "es" ? "Español" : "English"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
