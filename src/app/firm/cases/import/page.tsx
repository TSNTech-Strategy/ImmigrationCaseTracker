import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { IMPORT_MAX_ROWS } from "@/lib/firms/import";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import cases · CasePingo" };

export default async function ImportPage() {
  const user = await requireUser("/firm/cases/import");
  if (!(await firmService().getContext(user.id))) redirect("/firm");
  return (
    <>
      <Link href="/firm/cases" className="text-sm underline underline-offset-2">
        ← Cases
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Import cases from a CSV file</h1>
        <p className="text-sm text-[var(--muted)]">
          You&apos;ll see a preview first. Nothing is saved until you press Import. Clients are matched by your reference,
          then by exact name; anyone not found is added as a new client.
        </p>
      </div>
      <ImportForm maxRows={IMPORT_MAX_ROWS} />
    </>
  );
}
