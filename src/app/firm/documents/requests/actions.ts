"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth/session";
import { documentRequestService } from "@/lib/firms";

const NOT_SIGNED_IN: FormState = { error: "Your session has expired. Please sign in again." };

export async function createRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const get = (k: string) => String(formData.get(k) ?? "");
  // Checklist rows: ticked ones only. Custom rows: any non-empty label.
  const items = [
    ...formData.getAll("check").map(String).map((i) => ({ label: get(`label-${i}`), labelEs: get(`labelEs-${i}`), note: get(`note-${i}`), required: formData.get(`required-${i}`) === "1" })),
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ label: get(`custom-${i}`), required: true })),
  ];
  const values = { clientId: get("clientId"), caseId: get("caseId"), title: get("title"), message: get("message"), dueOn: get("dueOn") };
  const r = await documentRequestService().create(user.id, { ...values, items });
  if (!r.ok) return r.field ? { fieldErrors: { [r.field]: r.error }, values } : { error: r.error, values };
  if (formData.get("send") === "1") {
    const s = await documentRequestService().send(user.id, r.id);
    refresh();
    redirect(`/firm/documents/requests/${r.id}?notice=${s.ok ? "sent" : "created-not-sent"}`);
  }
  refresh();
  redirect(`/firm/documents/requests/${r.id}?notice=created`);
}

async function back(id: string, notice: string) {
  refresh();
  redirect(`/firm/documents/requests/${encodeURIComponent(id)}?notice=${notice}`);
}

export async function requestAction(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("requestId") ?? "");
  if (!user) redirect(`/login?next=/firm/documents/requests/${encodeURIComponent(id)}`);
  const svc = documentRequestService();
  switch (String(formData.get("op") ?? "")) {
    case "send": {
      const r = await svc.send(user.id, id);
      return back(id, r.ok ? "sent" : "send-error");
    }
    case "new-link": {
      const r = await svc.newLink(user.id, id);
      return back(id, r.ok ? "new-link" : "error");
    }
    case "cancel": {
      const r = await svc.setCanceled(user.id, id, true);
      return back(id, r.ok ? "canceled" : "error");
    }
    case "reopen": {
      const r = await svc.setCanceled(user.id, id, false);
      return back(id, r.ok ? "reopened" : "error");
    }
    case "accept":
    case "reject": {
      const op = String(formData.get("op"));
      const r = await svc.review(user.id, String(formData.get("itemId") ?? ""), op as "accept" | "reject", String(formData.get("reason") ?? ""));
      return back(id, r.ok ? (r.completed ? "completed" : op === "accept" ? "accepted" : "rejected") : op === "reject" ? "reason-needed" : "error");
    }
    default:
      return back(id, "error");
  }
}
