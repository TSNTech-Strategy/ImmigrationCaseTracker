import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";
import { firmAlertService, firmService, firmUpdateService } from "@/lib/firms";
import { FirmNav } from "./firm-nav";

export const instant = false;

export default async function FirmLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/firm");
  const ctx = await firmService().getContext(user.id);
  const [openUpdates, dueDeadlines] = ctx ? await Promise.all([firmUpdateService().openCount(ctx.firm.id, user.id), firmAlertService().openDeadlineCount(ctx.firm.id)]) : [0, 0];
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {ctx && <FirmNav firmName={ctx.firm.name} isManager={ctx.membership.role !== "STAFF"} openUpdates={openUpdates} dueDeadlines={dueDeadlines} />}
        {children}
      </div>
      <AppFooter />
    </>
  );
}
