import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import { ArchiveClientForm, EditClientForm } from "../forms";
import { FirmCaseList } from "../../cases/case-list";

export const metadata: Metadata = { title: "Client · CasePingo" };

const NOTICES: Record<string, string> = { created: "Client added. Now add their case." };

export default async function ClientPage({ params, searchParams }: PageProps<"/firm/clients/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/clients/${id}`);
  const data = await firmCaseService().getClient(user.id, id);
  if (!data) notFound();
  const { ctx, client } = data;
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const canArchive = ctx.membership.role !== "STAFF";

  return (
    <>
      <Link href="/firm/clients" className="text-sm underline underline-offset-2">
        ← Clients
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.displayName}
          {client.archivedAt && <span className="ml-2 align-middle text-sm font-normal text-[var(--muted)]">(archived)</span>}
        </h1>
        {!client.archivedAt && (
          <Link href={`/firm/cases/new?client=${client.id}`} className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)]">
            Add a case
          </Link>
        )}
      </div>
      {message && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      )}

      <section aria-labelledby="client-cases-h" className="flex flex-col gap-3">
        <h2 id="client-cases-h" className="text-lg font-semibold">
          Cases
        </h2>
        <FirmCaseList cases={client.cases.map((c) => ({ ...c, client: null }))} empty="No cases for this client yet." />
      </section>

      <section aria-labelledby="client-details-h" className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="client-details-h" className="text-lg font-semibold">
          Client details
        </h2>
        <EditClientForm
          clientId={client.id}
          initial={{ displayName: client.displayName, email: client.email, phone: client.phone, externalRef: client.externalRef }}
        />
      </section>

      {canArchive && (
        <section aria-labelledby="archive-h" className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-5">
          <h2 id="archive-h" className="text-lg font-semibold">
            {client.archivedAt ? "Restore" : "Archive"}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Archiving hides the client from your list and stops new cases for them. Existing cases keep being tracked until
            you remove them or withdraw consent.
          </p>
          <ArchiveClientForm clientId={client.id} archived={Boolean(client.archivedAt)} />
        </section>
      )}
    </>
  );
}
