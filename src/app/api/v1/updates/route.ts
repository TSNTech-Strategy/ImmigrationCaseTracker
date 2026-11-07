import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** The app's Updates tab: status changes across the person's cases, newest first. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().updates(user.id));
}
