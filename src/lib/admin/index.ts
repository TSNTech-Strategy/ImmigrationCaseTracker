import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser, type AppUser } from "@/lib/auth/session";
import { createAdminService } from "./service";

export const adminService = () => createAdminService({ db: prisma });

/**
 * Admin pages: listed in ADMIN_EMAILS, two-factor turned on, and passed this
 * session. Anyone else gets a plain 404 (the page's existence isn't revealed).
 */
export async function requireAdminPage(): Promise<{ user: AppUser; ready: boolean }> {
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();
  return { user, ready: user.mfaEnabled && user.aal === "aal2" };
}

/** Admin actions: same rule, or null. */
export async function getAdminUser(): Promise<AppUser | null> {
  const user = await getCurrentUser();
  return user && user.isAdmin && user.mfaEnabled && user.aal === "aal2" ? user : null;
}
