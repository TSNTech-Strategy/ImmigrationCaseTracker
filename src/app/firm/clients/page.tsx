import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import { CreateClientForm } from "./forms";

export const metadata: Metadata = { title: "Clients · CasePingo" };

export default async function ClientsPage({ searchParams }: PageProps<"/firm/clients">) {
  const user = await requireUser("/firm/clients");
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const data = await firmCaseService().listClients(user.id, { archived: showArchived });
  if (!data) redirect("/firm");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{showArchived ? "Archived clients" : "Clients"}</h1>
        <Link href={showArchived ? "/firm/clients" : "/firm/clients?archived=1"} className="text-sm underline underline-offset-2">
          {showArchived ? "Show active clients" : "Show archived clients"}
        </Link>
      </div>

      {data.clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          {showArchived ? "No archived clients." : "No clients yet. Add your first client below."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {data.clients.map((c) => (
            <li key={c.id}>
              <Link href={`/firm/clients/${c.id}`} className="flex flex-wrap items-baseline justify-between gap-2 p-4 hover:bg-[var(--background)]">
                <span>
                  <span className="font-medium">{c.displayName}</span>
                  {c.externalRef && <span className="text-sm text-[var(--muted)]"> · {c.externalRef}</span>}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  {c._count.cases} case{c._count.cases === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!showArchived && (
        <section aria-labelledby="add-client-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 id="add-client-h" className="text-lg font-semibold">
            Add a client
          </h2>
          <p className="text-sm text-[var(--muted)]">Contact details are optional and only visible to your firm.</p>
          <CreateClientForm />
        </section>
      )}
    </>
  );
}
