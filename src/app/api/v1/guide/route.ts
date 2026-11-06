import { mobileApi, respond } from "@/lib/mobile";

/** The plain-language status guide for the app's Status guide tab (public, no sign-in). */
export function GET() {
  return respond(mobileApi().guide());
}
