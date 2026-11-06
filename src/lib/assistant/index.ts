import "server-only";
import { prisma } from "@/lib/db";
import { claudeClient, type AssistantDeps } from "./service";

export { askAssistant, assistantStatus, ASSISTANT_MODEL } from "./service";
export { readAskBody } from "./conversation";

/** The assistant wired to the database and Claude (ANTHROPIC_API_KEY, server only). */
export const assistantDeps = (): AssistantDeps => ({ db: prisma, client: claudeClient() });
