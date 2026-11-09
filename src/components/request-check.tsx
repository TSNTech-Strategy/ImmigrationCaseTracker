/**
 * The checkbox beside each requested document. It ticks itself: empty while waiting, ticked the
 * moment the client uploads (blue: received, to review), green once the firm accepts it, red when
 * the firm asked for it again. Shown to the firm and to the client, so both see the same list.
 */
export type RequestItemStatus = "PENDING" | "UPLOADED" | "ACCEPTED" | "REJECTED";

const LOOK: Record<RequestItemStatus, { box: string; mark: "none" | "check" | "again" }> = {
  PENDING: { box: "border-2 border-[var(--border)] bg-[var(--surface)]", mark: "none" },
  UPLOADED: { box: "bg-[var(--accent)] text-[var(--accent-fg)]", mark: "check" },
  ACCEPTED: { box: "bg-[var(--success)] text-white", mark: "check" },
  REJECTED: { box: "border-2 border-[var(--danger)] bg-[var(--st-stop-bg)] text-[var(--danger)]", mark: "again" },
};

export function RequestCheck({ status, label }: { status: RequestItemStatus; label: string }) {
  const l = LOOK[status];
  return (
    <span role="img" aria-label={label} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${l.box}`}>
      {l.mark === "check" && (
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12 5 5 9-10" />
        </svg>
      )}
      {l.mark === "again" && (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 6v8m0 4h.01" />
        </svg>
      )}
    </span>
  );
}

/** "3 of 5 received": received counts uploads waiting for review and accepted documents. */
export function RequestProgress({ received, accepted, total, text }: { received: number; accepted: number; total: number; text: string }) {
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{text}</p>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={text}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]" style={{ width: `${pct(received)}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--success)]" style={{ width: `${pct(accepted)}%` }} />
      </div>
    </div>
  );
}
