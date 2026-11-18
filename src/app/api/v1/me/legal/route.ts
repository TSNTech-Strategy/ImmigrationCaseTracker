import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** Accept the current Terms and Privacy Policy from the app. Returns the profile (legal.accepted: true). */
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().acceptLegal(user.id));
}
