"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { firmImportService } from "@/lib/firms";
import { IMPORT_MAX_BYTES, type ImportPlan } from "@/lib/firms/import";

export type ImportState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  plan?: Omit<ImportPlan, "ok">;
  /** The file's text, sent back so "Import" re-submits exactly what was previewed. */
  csv?: string;
  basis?: string;
  evidenceRef?: string;
};

const basis = z.enum(["LEGAL_REPRESENTATIVE", "AUTHORIZED_BY_APPLICANT"]);

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const file = formData.get("file");
  const newFile = file instanceof File && file.size > 0;
  // A newly chosen file is always previewed first, never imported unseen.
  const intent = formData.get("intent") === "import" && !newFile ? "import" : "preview";
  let csv = String(formData.get("csv") ?? "");
  if (newFile) {
    if (file.size > IMPORT_MAX_BYTES) return { error: "That file is too large. Split it into files of up to 200 cases." };
    csv = await file.text();
  }
  const echo = { basis: String(formData.get("basis") ?? ""), evidenceRef: String(formData.get("evidenceRef") ?? "") };
  if (!csv.trim()) return { fieldErrors: { file: "Choose a CSV file or paste the rows." }, ...echo };
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
