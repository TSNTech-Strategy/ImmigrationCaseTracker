import type { ReactNode } from "react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
      {footer && <div className="text-center text-sm text-[var(--muted)]">{footer}</div>}
      <p className="text-center text-xs text-[var(--muted)]">
        Independent service. Not affiliated with or endorsed by USCIS or DHS. Not legal advice.
      </p>
    </main>
  );
}
