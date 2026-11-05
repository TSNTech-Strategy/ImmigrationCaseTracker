import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";

// Every page under /cases is per user.
export const instant = false;

export default async function CasesLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/cases");
  return (
    <>
      <AppHeader email={user.email} isAdmin={user.isAdmin} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">{children}</div>
      <AppFooter />
    </>
  );
}
