import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssistantChat } from "@/components/assistant-chat";
import { assistantDeps, assistantStatus } from "@/lib/assistant";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/features";

export const metadata: Metadata = { title: "Assistant · CasePingo" };

/** The CasePingo assistant. With ?case=<id>, questions are about that case (form and status only). */
export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  // Switched off for now (see src/lib/features.ts): old links land on My cases.
  if (!FEATURES.assistant) redirect("/cases");
  const user = await requireUser("/assistant");
  const status = await assistantStatus(assistantDeps(), user);
  const { case: caseId } = await searchParams;
  const c =
    typeof caseId === "string"
      ? await prisma.trackedCase.findFirst({ where: { id: caseId, ownerUserId: user.id }, select: { id: true, nickname: true, formType: true, statusTitleEn: true } })
      : null;
  const label = c ? [c.nickname ?? c.formType, c.statusTitleEn].filter(Boolean).join(" · ") || "Your case" : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm text-[var(--muted)]">Answers about your case, USCIS statuses, interviews and the civics test, from CasePingo&apos;s guides.</p>
      </div>
      <AssistantChat available={status.available} remaining={status.remaining} limit={status.limit} plan={status.plan} caseRef={c && label ? { id: c.id, label } : null} />
    </>
  );
}
