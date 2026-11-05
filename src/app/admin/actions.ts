"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { adminService, getAdminUser } from "@/lib/admin";
import { performAccountDeletion } from "@/lib/auth/delete-account";
import { prisma } from "@/lib/db";

const DENIED: FormState = { error: "Not allowed." };

export async function closeDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await getAdminUser();
  if (!admin) return DENIED;
  const status = formData.get("status") === "REJECTED" ? "REJECTED" : "COMPLETED";
  const r = await adminService().closeDeletionRequest(admin.id, String(formData.get("id") ?? ""), status, String(formData.get("note") ?? ""));
  if (!r.ok) return { error: r.error };
  refresh();
  return { success: status === "COMPLETED" ? "Marked as done." : "Declined." };
}

/** Run a failed account deletion again (billing, sign-in account, data). */
export async function retryAccountDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await getAdminUser();
  if (!admin) return DENIED;
  const req = await prisma.deletionRequest.findFirst({
    where: { id: String(formData.get("id") ?? ""), scope: "ACCOUNT", status: { in: ["REQUESTED", "IN_PROGRESS"] } },
  });
  const userId = req?.targetId ?? req?.requesterId;
  if (!req || !userId) return { error: "This request can't be retried automatically. Handle it by hand, then mark it done." };
  const r = await performAccountDeletion(req.id, userId);
  await prisma.auditLog.create({ data: { actorUserId: admin.id, action: "admin.deletion_retried", targetType: "DeletionRequest", targetId: req.id, metadata: { ok: r.ok } } });
  refresh();
  return r.ok ? { success: "Account deleted." } : { error: r.error };
}
