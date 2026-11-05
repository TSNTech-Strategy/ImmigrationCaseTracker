import { mobileApi, respond } from "@/lib/mobile";

/** Consent wording and other texts the app shows (so the server stays the source of truth). */
export function GET() {
  return respond(mobileApi().config());
}
