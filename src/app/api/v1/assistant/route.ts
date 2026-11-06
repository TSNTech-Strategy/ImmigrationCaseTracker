import { askAssistant, assistantDeps, assistantStatus, readAskBody } from "@/lib/assistant";
import { getMobileUser, unauthorized } from "@/lib/mobile";

// Answers stream for up to a minute.
export const maxDuration = 60;

/** The app's assistant: whether it's available and how many questions are left today. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return Response.json(await assistantStatus(assistantDeps(), user), { headers: { "cache-control": "no-store" } });
}

/** Ask a question: {messages: [{role, content}], caseId?}. The reply streams as newline-delimited JSON. */
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return askAssistant(assistantDeps(), user, await readAskBody(request), request.signal);
}
