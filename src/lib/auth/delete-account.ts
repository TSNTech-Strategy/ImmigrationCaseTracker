import "server-only";
import { prisma } from "@/lib/db";
import { billingEnabled, billingService } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Carry out an account deletion recorded in DeletionRequest. Used by the
 * person themselves (Settings) and by an admin retrying a failed request.
 * Order matters: stop billing, then the sign-in account (so they can't sign
 * back in to half-deleted data), then our data (cascades to cases, consents,
 * events, check runs, preferences and memberships).
 */
export async function performAccountDeletion(requestId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.deletionRequest.update({ where: { id: requestId }, data: { status: "IN_PROGRESS" } });
  const failed = async (notes: string, error: string) => {
    await prisma.deletionRequest.update({ where: { id: requestId }, data: { status: "REQUESTED", notes } });
    return { ok: false as const, error };
  };

  if (billingEnabled()) {
    try {
      await billingService().cancelForDeletedUser(userId);
    } catch {
      return failed("Billing cancellation failed; retry.", "We couldn't cancel the subscription right now, so the account wasn't deleted yet.");
    }
  }
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  if (error && !/not.?found/i.test(error.message ?? "")) {
    return failed("Auth deletion failed; retry.", "We couldn't delete the sign-in account right now. The request is recorded.");
  }
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.deletionRequest.update({ where: { id: requestId }, data: { status: "COMPLETED", completedAt: new Date(), notes: null } });
  return { ok: true };
}
