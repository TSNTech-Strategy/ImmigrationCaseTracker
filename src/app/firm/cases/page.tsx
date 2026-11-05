import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import { getUscisClient } from "@/lib/uscis";
import { FirmCaseList } from "./case-list";

export const metadata: Metadata = { title: "Firm cases · CasePingo" };

const NOTICES: Record<string, string> = { removed: "The case was removed. We've stopped checking it." };

export default async function FirmCasesPage({ searchParams }: PageProps<"/firm/cases">) {
  const user = await requireUser("/firm/cases");
  const { client, notice } = await searchParams;
  const clientId = typeof client === "string" && client ? client : undefined;
  const svc = firmCaseService();
  const [data, clients] = await Promise.all([svc.listCases(user.id, { clientId }), svc.listClients(user.id)]);
  if (!data || !clients) redirect("/firm");
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <Link href="/firm/cases/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
          Add a case
        </Link>
      </div>
      <ModeBanner mode={getUscisClient().mode} />
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}
      {clients.clients.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-client" className="font-medium">
              Client
            </label>
            <select
              id="filter-client"
              name="client"
              defaultValue={clientId ?? ""}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <option value="">All clients</option>
              {clients.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-2">
            Filter
          </button>
        </form>
      )}
      <FirmCaseList
        cases={data.cases}
        empty={clientId ? "No cases for this client." : "Your firm isn't tracking any cases yet. Add a client, then their case."}
      />
    </>
  );
}
