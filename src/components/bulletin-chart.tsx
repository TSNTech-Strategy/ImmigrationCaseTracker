import { AREA_LABEL, AREAS, type Area, type ChartKey, monthLabel } from "@/lib/visa-bulletin/model";
import type { ViewCell, ViewRow } from "@/lib/visa-bulletin/view";

/** The four charts in the order the bulletin prints them. */
export const BULLETIN_CHARTS: { key: ChartKey; title: string; note: string }[] = [
  { key: "familyFinal", title: "Family-sponsored: final action dates", note: "When a green card can be issued." },
  { key: "familyFiling", title: "Family-sponsored: dates for filing", note: "When you may submit your application, if USCIS accepts this chart this month." },
  { key: "employmentFinal", title: "Employment-based: final action dates", note: "When a green card can be issued." },
  { key: "employmentFiling", title: "Employment-based: dates for filing", note: "When you may submit your application, if USCIS accepts this chart this month." },
];

/** "▲ Moved ahead 3 months" in green, "▼ Moved back…" in red, "No change" in grey. */
export function MoveNote({ move, className = "text-xs" }: { move: NonNullable<ViewCell["move"]>; className?: string }) {
  const tone = move.tone === "good" ? "text-[var(--success)]" : move.tone === "bad" ? "text-[var(--danger)]" : "text-[var(--muted)]";
  return (
    <span className={`block ${className} ${tone}`}>
      {move.tone === "good" ? "▲ " : move.tone === "bad" ? "▼ " : ""}
      {move.en}
    </span>
  );
}

/** Explains the arrows; dates without a note didn't change. */
export function BulletinLegend({ previousMonth }: { previousMonth: string }) {
  return (
    <p className="text-sm text-[var(--muted)]">
      Changes since {monthLabel(previousMonth)}: <span className="text-[var(--success)]">▲ moved ahead</span>, <span className="text-[var(--danger)]">▼ moved back</span>.
      Dates without a note didn&apos;t change.
    </p>
  );
}

/**
 * One chart: categories down the side, the five chargeability areas across. The
 * category column stays put while the table scrolls sideways on a phone. `compact`
 * (the narrower signed-in page) shows only the category code; `mine` highlights the
 * person's own category row and outlines their country's date.
 */
export function BulletinChart({
  id,
  title,
  note,
  rows,
  compact = false,
  mine = null,
}: {
  id: string;
  title: string;
  note: string;
  rows: ViewRow[];
  compact?: boolean;
  mine?: { category: string; area: Area } | null;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <p className="text-sm text-[var(--muted)]">{note}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className={`w-full min-w-[700px] table-fixed text-left text-sm ${compact ? "sm:min-w-0" : "sm:min-w-[760px]"}`}>
          <colgroup>
            <col className={compact ? "w-24" : "w-24 sm:w-[28%]"} />
            {AREAS.map((a) => (
              <col key={a} />
            ))}
          </colgroup>
          <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-[var(--surface-2)] px-3 py-2.5 font-medium sm:px-4">
                Category
              </th>
              {AREAS.map((a) => (
                <th key={a} scope="col" className="px-3 py-2.5 font-medium">
                  {AREA_LABEL[a].en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMine = mine?.category === r.category;
              const rowBg = isMine ? "bg-[var(--accent-soft)]" : "bg-[var(--surface)]";
              return (
                <tr key={r.category} className={`border-t border-[var(--border)] align-top ${rowBg}`}>
                  <th scope="row" className={`sticky left-0 z-10 px-3 py-2.5 font-normal sm:px-4 ${rowBg}`}>
                    <span className="font-semibold">{r.code}</span>
                    <span className={compact ? "sr-only" : "sr-only text-xs text-[var(--muted)] sm:not-sr-only sm:block"}>{r.en}</span>
                    {isMine && <span className="block text-xs font-semibold text-[var(--accent)]">Yours</span>}
                  </th>
                  {AREAS.map((a) => {
                    const cell = r.cells[a];
                    const myCell = isMine && mine?.area === a;
                    return (
                      <td key={a} className={`px-3 py-2.5 ${myCell ? "shadow-[inset_0_0_0_2px_var(--accent)]" : ""}`}>
                        <span className={`whitespace-nowrap tabular-nums ${myCell ? "font-bold" : "font-medium"}`}>{cell?.value.en ?? "—"}</span>
                        {cell?.move?.changed && <MoveNote move={cell.move} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
