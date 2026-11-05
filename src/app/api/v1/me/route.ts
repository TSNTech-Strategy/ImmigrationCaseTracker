import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";
import { performAccountDeletion } from "@/lib/auth/delete-account";
import { prisma } from "@/lib/db";
import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** Profile, plan and alert settings. GET also accepts the web session (read-only). */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return respond(await mobileApi().me(user.id));
}

/** Update name, language, email alerts, push alerts. */
export async function PATCH(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().updateMe(user.id, await readJson(request)));
}

/** Delete the account from the app (required by Apple and Google). Body: {"confirm":"DELETE"}. */
export async function DELETE(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const body = (await readJson(request)) as { confirm?: unknown };
  if (body.confirm !== "DELETE") return respond({ status: 400, body: { error: "invalid", message: 'Send {"confirm":"DELETE"} to delete the account.' } });
  const ownsFirm = await prisma.firmMembership.findFirst({ where: { userId: user.id, role: "OWNER", revokedAt: null } });
  if (ownsFirm) {
    return respond({
      status: 409,
      body: { error: "firm_owner", message: "You own a law-firm workspace. Transfer ownership or close the firm on casepingo.com first." },
    });
  }
  const request_ = await prisma.deletionRequest.create({
    data: { requesterId: user.id, requesterEmail: user.email, scope: "ACCOUNT", targetId: user.id, status: "IN_PROGRESS", notes: "From the mobile app" },
  });
  const r = await performAccountDeletion(request_.id, user.id);
  return r.ok ? respond({ status: 200, body: { deleted: true } }) : respond({ status: 503, body: { error: "try_again", message: r.error } });
}
