import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService, firmTaskService, firmUpdateService } from "@/lib/firms";
import { TaskTable } from "../../tasks/task-list";
import { CopyLink } from "@/components/copy-link";
import { LocalTime } from "@/components/local-time";
import { ArchiveClientForm, EditClientForm } from "../forms";
import { setClientPortalAction } from "../actions";
import { COUNTRIES, countryName, maskANumber } from "@/lib/firms/profile";
import { FirmCaseList } from "../../cases/case-list";

export const metadata: Metadata = { title: "Client · CasePingo" };

const NOTICES: Record<string, string> = {
  created: "Client added. Now add their case.",
  portal_on: "Status page turned on. Copy the link and send it to your client.",
  portal_new: "New link made. The old link no longer works.",
  portal_off: "Status page turned off. The link no longer works.",
};
const ERRORS: Record<string, string> = { portal_error: "That didn't work. Try again." };

function PortalButton({ clientId, portal, children, primary }: { clientId: string; portal: "on" | "off" | "new"; children: string; primary?: boolean }) {
  return (
    <form action={setClientPortalAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="portal" value={portal} />
      <button
        type="submit"
        className={primary ? "rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]" : "rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"}
      >
        {children}
      </button>
    </form>
  );
}

type ClientForForm = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  countryOfBirth: string | null;
  citizenship: string | null;
  aNumber: string | null;
  email: string | null;
  phone: string | null;
  externalRef: string | null;
  locale: string;
  updatesConsentAt: Date | null;
};

/** Form values; clients added before first/last names existed get theirs split from the full name. */
function initialValues(c: ClientForForm) {
  const parts = c.displayName.trim().split(/\s+/);
  const first = c.firstName ?? (parts.length > 1 ? parts.slice(0, -1).join(" ") : c.displayName);
  const last = c.lastName ?? (parts.length > 1 ? parts[parts.length - 1]! : "");
  return {
    firstName: first,
    lastName: last,
    dateOfBirth: c.dateOfBirth ?? "",
    countryOfBirth: c.countryOfBirth ?? "",
    citizenship: c.citizenship ?? "",
    aNumber: c.aNumber ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    externalRef: c.externalRef ?? "",
    locale: c.locale,
    updatesConsent: Boolean(c.updatesConsentAt),
  };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/firm/clients/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/firm/clients/${id}`);
  const data = await firmCaseService().getClient(user.id, id);
  if (!data) notFound();
  const { ctx, client } = data;
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  const error = typeof notice === "string" ? ERRORS[notice] : undefined;
  const portalUrl = firmUpdateService().portalUrl(client);
  const clientTasks = await firmTaskService().list(user.id, { scope: "team", status: "active", clientId: client.id });
  const canArchive = ctx.membership.role !== "STAFF";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
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
      {error && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-3">
        {[
          ["Country of birth", countryName(client.countryOfBirth)],
          ["Citizenship", countryName(client.citizenship)],
          ["A-Number", maskANumber(client.aNumberLast4)],
          ["Email", client.email],
          ["Phone", client.phone],
          ["Language", client.locale === "es" ? "Español" : "English"],
          ["Reference", client.externalRef],
          ["Case updates by email", client.updatesConsentAt ? "Agreed" : "Not agreed"],
        ].map(([k, val]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="truncate font-medium">{val ?? <span className="font-normal text-[var(--muted)]">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="client-cases-h" className="flex flex-col gap-3">
        <h2 id="client-cases-h" className="text-lg font-semibold">
          Cases
        </h2>
        <FirmCaseList cases={client.cases.map((c) => ({ ...c, client: null }))} empty="No cases for this client yet." />
      </section>

      <section aria-labelledby="client-tasks-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="client-tasks-h" className="text-lg font-semibold">
            Open tasks
          </h2>
          <Link href={`/firm/tasks/new?client=${client.id}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]">
            New task
          </Link>
        </div>
        {clientTasks && clientTasks.tasks.length > 0 ? (
          <TaskTable tasks={clientTasks.tasks} today={clientTasks.today} back={`/firm/clients/${client.id}`} compact />
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">No open tasks for this client.</p>
        )}
      </section>

      <section aria-labelledby="client-details-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="client-details-h" className="text-lg font-semibold">
          Client details
        </h2>
        <EditClientForm
          clientId={client.id}
          initial={initialValues(client)}
          countries={COUNTRIES}
        />
        {client.updatesConsentAt && (
          <p className="text-xs text-[var(--muted)]">
            Update agreement recorded <LocalTime iso={client.updatesConsentAt.toISOString()} />.
          </p>
        )}
      </section>

      <section aria-labelledby="status-page-h" className="flex scroll-mt-24 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="status-page-h" className="text-lg font-semibold">
          Client status page
        </h2>
        <p className="text-sm text-[var(--muted)]">
          A private page your client can open any time to see where each of their cases stands and what comes next, in English or Spanish. No sign-in: anyone with the link can see it, so send it only to your client. It never shows full receipt numbers.
        </p>
        {portalUrl ? (
          <>
            <CopyLink url={portalUrl} label="Link to send your client" />
            <div className="flex flex-wrap gap-2">
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]">
                Open the page
              </a>
              <PortalButton clientId={client.id} portal="new">
                Make a new link
              </PortalButton>
              <PortalButton clientId={client.id} portal="off">
                Turn off
              </PortalButton>
            </div>
            <p className="text-xs text-[var(--muted)]">A new link stops the old one from working. Use it if the link reached the wrong person.</p>
          </>
        ) : (
          <div>
            <PortalButton clientId={client.id} portal="on" primary>
              Turn on the status page
            </PortalButton>
          </div>
        )}
      </section>

      {canArchive && (
        <section aria-labelledby="archive-h" className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-5">
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
    </div>
  );
}
