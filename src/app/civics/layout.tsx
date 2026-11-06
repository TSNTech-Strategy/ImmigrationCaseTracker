import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";

// Civics test practice for signed-in people (the public version is /civics-test).
export const instant = false;

export default async function CivicsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/civics");
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">{children}</div>
      <AppFooter />
    </>
  );
}
