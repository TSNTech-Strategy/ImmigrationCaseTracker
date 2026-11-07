"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { firmImportService } from "@/lib/firms";
import { IMPORT_MAX_BYTES, pastedReceiptsToCsv, type ImportPlan } from "@/lib/firms/import";

export type ImportState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  plan?: Omit<ImportPlan, "ok">;
  /** The file's text, sent back so "Import" re-submits exactly what was previewed. */
  csv?: string;
  basis?: string;
  evidenceRef?: string;
  mode?: "file" | "paste";
  pasted?: string;
  pasteClient?: string;
  pasteClientRef?: string;
};

const basis = z.enum(["LEGAL_REPRESENTATIVE", "AUTHORIZED_BY_APPLICANT"]);

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const mode = formData.get("mode") === "paste" ? "paste" : "file";
  const echo = {
    basis: String(formData.get("basis") ?? ""),
    evidenceRef: String(formData.get("evidenceRef") ?? ""),
    mode,
    pasted: String(formData.get("pasted") ?? "").slice(0, IMPORT_MAX_BYTES),
    pasteClient: String(formData.get("pasteClient") ?? "").trim(),
    pasteClientRef: String(formData.get("pasteClientRef") ?? "").trim(),
  } as const;
  // Browsers send line breaks in form fields as CRLF; compare like with like.
  const previewed = String(formData.get("csv") ?? "").replace(/\r\n?/g, "\n");
  let csv: string;
  let changed: boolean;
  if (mode === "paste") {
    if (!echo.pasted.trim()) return { fieldErrors: { pasted: "Paste the receipt numbers." }, ...echo };
    if (echo.pasteClient.length < 2 && !echo.pasteClientRef) return { fieldErrors: { pasteClient: "Add the client's name (an existing client or a new one)." }, ...echo };
    const p = pastedReceiptsToCsv(echo.pasted, echo.pasteClient, echo.pasteClientRef);
    if (!p.count) return { fieldErrors: { pasted: "No receipt numbers found. They look like EAC1234567890: 3 letters and 10 digits." }, ...echo };
    csv = p.csv;
    changed = csv !== previewed;
  } else {
    const file = formData.get("file");
    const newFile = file instanceof File && file.size > 0;
    csv = previewed;
    if (newFile) {
      if (file.size > IMPORT_MAX_BYTES) return { error: "That file is too large. Split it into files of up to 200 cases.", ...echo };
      csv = await file.text();
    }
    changed = newFile;
  }
  // New or changed input is always previewed first, never imported unseen.
  const intent = formData.get("intent") === "import" && !changed ? "import" : "preview";
  if (!csv.trim()) return { fieldErrors: { file: "Choose a CSV file, or paste receipt numbers instead." }, ...echo };
  const b = basis.safeParse(echo.basis);
  if (!b.success) return { fieldErrors: { basis: "Choose how your firm is authorized." }, csv, ...echo };
  if (formData.get("attest") !== "on") return { fieldErrors: { attest: "Please confirm the statement to continue." }, csv, ...echo };
  const defaults = { basis: b.data, evidenceRef: echo.evidenceRef };

  const svc = firmImportService();
  if (intent === "preview") {
    const p = await svc.preview(user.id, csv, defaults);
    if (!p.ok) return { error: p.error, csv, ...echo };
    return { plan: { rows: p.rows, toAdd: p.toAdd, newClients: p.newClients, newTags: p.newTags, errors: p.errors }, csv, ...echo };
  }
  const r = await svc.run(user.id, csv, defaults);
  if (!r.ok) return { error: r.error, csv, ...echo };
  redirect(`/firm/cases?notice=imported&added=${r.added}&skipped=${r.skipped}`);
}
