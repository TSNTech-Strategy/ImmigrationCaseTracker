import Link from "next/link";

/** Files | Requests, inside the Documents tab. */
export function DocumentsSubNav({ current, openRequests }: { current: "files" | "requests"; openRequests?: number }) {
  const cls = "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] aria-[current=page]:bg-[var(--surface)] aria-[current=page]:text-[var(--foreground)] aria-[current=page]:shadow-[var(--shadow)]";
  return (
    <nav aria-label="Documents" className="flex w-fit gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
      <Link href="/firm/documents" aria-current={current === "files" ? "page" : undefined} className={cls}>
        Files
      </Link>
      <Link href="/firm/documents/requests" aria-current={current === "requests" ? "page" : undefined} className={cls}>
        Requests to clients{openRequests ? <span className="ml-1.5 tabular-nums opacity-70">{openRequests}</span> : null}
      </Link>
    </nav>
  );
}
