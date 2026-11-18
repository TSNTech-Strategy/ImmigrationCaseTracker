"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { safeNextPath } from "@/lib/auth/paths";
import { getSessionState } from "@/lib/auth/session";
import { SITE } from "@/lib/site";

/** Records that the signed-in user accepted the current Terms and Privacy Policy. */
export async function acceptLegalAction(formData: FormData): Promise<void> {
  const s = await getSessionState();
  if (s.state === "none") redirect("/login");
  if (s.state === "mfa_required") redirect("/login/mfa");
  const t = new Date();
  await prisma.user.update({ where: { id: s.user.id }, data: { legalAcceptedVersion: SITE.legalVersion, legalAcceptedAt: t } });
  await prisma.auditLog.create({
    data: { actorUserId: s.user.id, action: "legal.accepted", targetType: "User", targetId: s.user.id, metadata: { version: SITE.legalVersion } },
  });
  redirect(safeNextPath(formData.get("next")));
}
