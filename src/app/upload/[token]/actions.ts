"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { documentRequestService } from "@/lib/firms";

/** A client uploads one file for one requested document, by the private link (no account). */
export async function clientUploadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const es = formData.get("lang") === "es";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: es ? "Elija un archivo o tome una foto." : "Choose a file or take a photo." };
  const r = await documentRequestService().uploadFromClient(token, itemId, { data: Buffer.from(await file.arrayBuffer()), name: file.name });
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: es ? `Recibido: ${r.name}. Su abogado lo revisará.` : `Received: ${r.name}. Your law firm will review it.`, values: { stamp: String(Date.now()) } };
}
