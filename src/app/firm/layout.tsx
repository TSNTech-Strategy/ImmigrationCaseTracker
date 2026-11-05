import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";
import { firmService } from "@/lib/firms";
import { FirmNav } from "./firm-nav";

export const instant = false;

export default async function FirmLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/firm");
  const ctx = await firmService().getContext(user.id);
  return (
    <>
      <AppHeader email={user.email} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {ctx && <FirmNav firmName={ctx.firm.name} />}
        {children}
      </div>
      <AppFooter />
    </>
  );
}
