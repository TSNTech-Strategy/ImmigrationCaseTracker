import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireAdminPage } from "@/lib/admin";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminPage();
  return (
    <>
      <AppHeader name={user.name} email={user.email} isAdmin />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">{children}</div>
      <AppFooter />
    </>
  );
}
