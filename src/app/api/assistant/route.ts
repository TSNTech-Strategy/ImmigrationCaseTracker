import { askAssistant, assistantDeps, readAskBody } from "@/lib/assistant";
import { getCurrentUser } from "@/lib/auth/session";

// Answers stream for up to a minute.
export const maxDuration = 60;

/**
 * The website's assistant (signed-in cookie session). Same-origin requests
 * only, so another site can't use someone's daily questions.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "forbidden", message: "Not allowed." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401, headers: { "cache-control": "no-store" } });
  return askAssistant(assistantDeps(), user, await readAskBody(request), request.signal);
}
