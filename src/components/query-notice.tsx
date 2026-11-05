"use client";

import { useSearchParams } from "next/navigation";

/** Shows a one-off message chosen by ?notice=… without making the page dynamic. */
export function QueryNotice({ messages }: { messages: Record<string, string> }) {
  const notice = useSearchParams().get("notice");
  const text = notice ? messages[notice] : undefined;
  if (!text) return null;
  return (
    <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
      {text}
    </p>
  );
}
