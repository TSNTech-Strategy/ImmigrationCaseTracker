import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { firmService } from "@/lib/firms";
import { IMPORT_MAX_ROWS } from "@/lib/firms/import";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import cases · CasePingo" };

export default async function ImportPage() {
  const user = await requireUser("/firm/cases/import");
  const ctx = await firmService().getContext(user.id);
  if (!ctx) redirect("/firm");
  const clients = await prisma.client.findMany({ where: { firmId: ctx.firm.id, archivedAt: null }, select: { displayName: true }, orderBy: { displayName: "asc" }, take: 500 });
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <Link href="/firm/cases" className="text-sm underline underline-offset-2">
        ← Cases
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Import cases</h1>
        <p className="text-sm text-[var(--muted)]">
          Upload a CSV file (including exports from Docketwise or Clio) or paste receipt numbers. You&apos;ll see a preview first. Nothing is saved until you press Import. Clients are matched by your reference,
          then by exact name; anyone not found is added as a new client.
        </p>
      </div>
      <ImportForm maxRows={IMPORT_MAX_ROWS} clients={clients.map((c) => c.displayName)} />
    </div>
  );
}
