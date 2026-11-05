import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModeBanner } from "@/components/mode-banner";
import { requireUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";
import { getUscisClient } from "@/lib/uscis";
import { AddFirmCaseForm } from "../forms";

export const metadata: Metadata = { title: "Add a firm case · CasePingo" };

export default async function NewFirmCasePage({ searchParams }: PageProps<"/firm/cases/new">) {
  const user = await requireUser("/firm/cases/new");
  const { client } = await searchParams;
  const data = await firmCaseService().listClients(user.id);
  if (!data) redirect("/firm");

  return (
    <>
      <Link href="/firm/cases" className="text-sm underline underline-offset-2">
        ← Cases
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a client&apos;s case</h1>
      <ModeBanner mode={getUscisClient().mode} />
      {data.clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
          Add a client first, then add their case.{" "}
          <Link href="/firm/clients" className="underline underline-offset-2">
            Add a client
          </Link>
        </p>
      ) : (
        <AddFirmCaseForm
          clients={data.clients.map((c) => ({ id: c.id, displayName: c.displayName }))}
          clientId={typeof client === "string" ? client : undefined}
        />
      )}
    </>
  );
}
