import { askAssistant, assistantDeps, readAskBody } from "@/lib/assistant";
import { getCurrentUser } from "@/lib/auth/session";
import { FEATURES } from "@/lib/features";

// Answers stream for up to a minute.
export const maxDuration = 60;

/** While the assistant is switched off (src/lib/features.ts), its API answers 404. */
function switchedOff() {
  return Response.json({ error: "not_found", message: "The assistant isn't available." }, { status: 404, headers: { "cache-control": "no-store" } });
}

/**
 * The website's assistant (signed-in cookie session). Same-origin requests
 * only, so another site can't use someone's daily questions.
 */
export async function POST(request: Request) {
  if (!FEATURES.assistant) return switchedOff();
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "forbidden", message: "Not allowed." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401, headers: { "cache-control": "no-store" } });
  return askAssistant(assistantDeps(), user, await readAskBody(request), request.signal);
}
