import { askAssistant, assistantDeps, assistantStatus, readAskBody } from "@/lib/assistant";
import { FEATURES } from "@/lib/features";
import { getMobileUser, unauthorized } from "@/lib/mobile";

// Answers stream for up to a minute.
export const maxDuration = 60;

/** While the assistant is switched off (src/lib/features.ts), its API answers 404. */
function switchedOff() {
  return Response.json({ error: "not_found", message: "The assistant isn't available." }, { status: 404, headers: { "cache-control": "no-store" } });
}

/** The app's assistant: whether it's available and how many questions are left today. */
export async function GET(request: Request) {
  if (!FEATURES.assistant) return switchedOff();
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return Response.json(await assistantStatus(assistantDeps(), user), { headers: { "cache-control": "no-store" } });
}

/** Ask a question: {messages: [{role, content}], caseId?}. The reply streams as newline-delimited JSON. */
export async function POST(request: Request) {
  if (!FEATURES.assistant) return switchedOff();
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return askAssistant(assistantDeps(), user, await readAskBody(request), request.signal);
}
