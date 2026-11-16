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
      <ExportGuide />
    </div>
  );
}

/**
 * Short, tool-neutral steps for getting cases out of another system. Menu names differ between
 * versions of each product, so this says what to look for rather than exact clicks.
 */
const GUIDE: { tool: string; steps: string[] }[] = [
  {
    tool: "Docketwise",
    steps: [
      "Open your list of matters or cases, or a report that lists them.",
      "Make sure the columns include the client's name and the USCIS receipt number (add the matter number too, if you want it as your reference).",
      "Export the list as CSV (or as Excel, then save it as CSV).",
    ],
  },
  {
    tool: "Clio",
    steps: [
      "Open Matters, or a matters report, and show the columns for the client, the matter number and the field where you keep receipt numbers.",
      "Export the list as CSV.",
      "If receipt numbers live in a custom field or in the matter description, include that column: CasePingo finds receipt numbers in any column.",
    ],
  },
  {
    tool: "MyCase, LollyLaw, eImmigration or another system",
    steps: [
      "Find a case or matter list (or report) that shows the client name and receipt number.",
      "Export it as CSV or Excel. If it's Excel, open it and use Save as, CSV.",
    ],
  },
  {
    tool: "A spreadsheet (Excel, Google Sheets, Numbers)",
    steps: [
      "Keep one row per case, with the client's name and the receipt number. Other columns are fine.",
      "Excel: File, Save as, CSV. Google Sheets: File, Download, Comma-separated values (.csv).",
    ],
  },
];

function ExportGuide() {
  return (
    <section aria-labelledby="export-guide-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 id="export-guide-h" className="text-lg font-semibold">
        Moving from another system
      </h2>
      <p className="text-sm text-[var(--muted)]">
        Keep your forms where they are: CasePingo works alongside them, watching USCIS and keeping your clients updated. To bring your cases over, export a
        list from your current system and upload it above. Column names don&apos;t need to match the template: CasePingo recognizes common names (client,
        applicant, matter number, receipt number) and finds receipt numbers by their format.
      </p>
      <ul className="flex flex-col gap-2">
        {GUIDE.map((g) => (
          <li key={g.tool}>
            <details className="group rounded-md border border-[var(--border)] px-4 py-3">
              <summary className="cursor-pointer font-medium">{g.tool}</summary>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--muted)]">
        Menu names change between versions of each product, so these steps say what to look for. Stuck? Paste the receipt numbers instead, or write to us and
        we&apos;ll help with the file.
      </p>
    </section>
  );
}
