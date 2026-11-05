import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <PublicFooter />
    </>
  );
}
