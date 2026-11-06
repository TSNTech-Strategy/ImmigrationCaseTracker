import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { FEATURES } from "@/lib/features";

// The assistant is per user (daily questions, their cases).
export const instant = false;

export default async function AssistantLayout({ children }: { children: ReactNode }) {
  if (!FEATURES.assistant) redirect("/cases");
  const user = await requireUser("/assistant");
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8">{children}</div>
      <AppFooter />
    </>
  );
}
