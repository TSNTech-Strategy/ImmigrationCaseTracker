import { SANDBOX_RECEIPTS } from "@/lib/receipt";

/** Tells users when statuses aren't live USCIS data. Hidden in production mode. */
export function ModeBanner({ mode }: { mode: "mock" | "sandbox" | "production" }) {
  if (mode === "production") return null;
  const text =
    mode === "mock"
      ? "Demo mode: statuses are simulated and do not come from USCIS."
      : `Test mode: connected to the USCIS sandbox. Only USCIS sample receipts (${Object.values(SANDBOX_RECEIPTS).join(", ")}) return data.`;
  return (
    <p role="note" className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
      {text}
    </p>
  );
}
