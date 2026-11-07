import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** Immigration court (EOIR): a guide and links to EOIR's official tools. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(mobileApi().court());
}
