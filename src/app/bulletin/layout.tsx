import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";

// The Visa Bulletin for signed-in people: their own category first.
export const instant = false;

export default async function BulletinLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/bulletin");
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">{children}</div>
      <AppFooter />
    </>
  );
}
