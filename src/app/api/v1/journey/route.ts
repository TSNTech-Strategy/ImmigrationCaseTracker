import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** All of the person's cases on one timeline: total days, a bar per case, milestones with day counts. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().journey(user.id));
}
