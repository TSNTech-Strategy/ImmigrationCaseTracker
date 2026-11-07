import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";
import { firmAlertService, firmService, firmTaskService, firmTeamService, firmUpdateService } from "@/lib/firms";
import { FirmNav } from "./firm-nav";

export const instant = false;

export default async function FirmLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/firm");
  const ctx = await firmService().getContext(user.id);
  const [openUpdates, dueDeadlines, dueTasks] = ctx
    ? await Promise.all([
        firmUpdateService().openCount(ctx.firm.id, user.id),
        firmAlertService().openDeadlineCount(ctx.firm),
        firmTaskService().dueCount(ctx.firm, user.id),
        // "Last active" on the team page (written at most every few minutes).
        firmTeamService().touch(user.id).catch(() => {}),
      ])
    : [0, 0, 0];
  return (
    <>
      <AppHeader user={user} wide />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {ctx && <FirmNav firmName={ctx.firm.name} isManager={ctx.membership.role !== "STAFF"} openUpdates={openUpdates} dueDeadlines={dueDeadlines} dueTasks={dueTasks} />}
        {children}
      </div>
      <AppFooter wide />
    </>
  );
}
