import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** Document checklists for each case type, with this person's progress. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().listChecklists(user.id));
}
