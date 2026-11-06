import { getMobileUser, respond } from "@/lib/mobile";
import { bulletinApi } from "@/lib/visa-bulletin";

/** The latest Visa Bulletin (public); with a sign-in token it also includes the person's category. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  return respond(await bulletinApi().get(user?.id ?? null));
}
