import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        CasePingo
      </Link>
      <div className="flex flex-col gap-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
      {footer && <div className="text-center text-sm text-[var(--muted)]">{footer}</div>}
      <p className="text-center text-xs text-[var(--muted)]">
        Independent service. Not affiliated with or endorsed by USCIS or DHS. Not legal advice.
      </p>
    </main>
  );
}
