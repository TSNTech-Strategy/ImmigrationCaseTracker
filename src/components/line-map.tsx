import type { CSSProperties } from "react";
import type { LineMap, Tone } from "@/lib/journeys";

const TONE: Record<Tone, string> = { progress: "var(--st-progress)", action: "var(--st-action)", done: "var(--st-done)", stop: "var(--st-stop)" };

/** "Feb 26, 2024" from "2024-02-26" (the date as USCIS reported it, so no time zone shift). */
export function formatDay(day: string | null, es: boolean): string {
  if (!day) return "—";
  return new Intl.DateTimeFormat(es ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Where step i's dot sits on the track: dots are 24px wide, at the ends of equal segments. */
const at = (i: number, n: number) => (n > 1 ? i / (n - 1) : 0);
const leftFor = (frac: number) => `calc(${frac} * (100% - 24px) + 12px)`;

/**
 * The case's line map: the steps for this kind of case, a marker over the current step,
 * then every step with the date USCIS reported for it. Server-rendered, no script.
 */
export function LineMapSection({ map, es, idPrefix = "linemap" }: { map: LineMap; es: boolean; idPrefix?: string }) {
  if (map.current < 0) return null;
  const lang = es ? "es" : "en";
  const n = map.steps.length;
  const color = TONE[map.tone];
  const frac = at(map.current, n);
  const marker = map.marker?.[lang] ?? null;
  const summary = `${map.name[lang]}: ${es ? "paso" : "step"} ${map.current + 1} ${es ? "de" : "of"} ${n}${marker ? `, ${marker}` : ""}`;
  return (
    <section aria-labelledby={`${idPrefix}-h`} className="flex flex-col gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6" style={{ "--tone": color } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${idPrefix}-h`} className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          {es ? "Mapa del proceso" : "Line map"}
        </h2>
        <p className="text-sm font-semibold">{map.name[lang]}</p>
      </div>

      <div role="img" aria-label={summary} className="relative" style={{ paddingTop: marker ? 40 : 0 }}>
        {marker && (
          <>
            <span
              className="absolute top-0 max-w-full truncate rounded-md px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--surface)]"
              style={{ left: leftFor(frac), transform: `translateX(-${frac * 100}%)`, background: "var(--tone)" }}
            >
              {marker}
            </span>
            <span className="absolute top-[26px] h-3.5 w-0.5 -translate-x-1/2" style={{ left: leftFor(frac), background: "var(--tone)" }} />
          </>
        )}
        <div className="flex h-6 items-center">
          {map.steps.map((s, i) => {
            const reached = s.state !== "upcoming";
            const fade = map.current > 0 ? 0.35 + 0.65 * (i / map.current) : 1;
            return (
              <div key={s.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
                {i > 0 && (
                  <span className="h-1.5 flex-1 rounded-full" style={i <= map.current ? { background: "var(--tone)", opacity: fade } : { background: "var(--border)" }} />
                )}
                {s.state === "current" ? (
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full" style={{ background: "var(--tone)" }}>
                    <span className="h-4 w-4 rounded-full border-[3px] border-[var(--surface)]" style={{ background: "var(--tone)" }} />
                  </span>
                ) : (
                  <span
                    className={`h-3.5 w-3.5 flex-none rounded-full ${reached ? "" : "border-2 border-[var(--border)] bg-[var(--surface)]"}`}
                    style={reached ? { background: "var(--tone)", opacity: fade } : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ol className="flex flex-col gap-2.5">
        {map.steps.map((s) => (
          <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="flex items-center gap-2.5 text-[0.95rem]">
            <StepIcon state={s.state} />
            <span className={`flex-1 ${s.state === "current" ? "font-semibold" : s.state === "upcoming" ? "text-[var(--muted)]" : ""}`}>
              {s.label[lang]}
              <span className="sr-only">{s.state === "done" ? (es ? " (hecho)" : " (done)") : s.state === "current" ? (es ? " (ahora)" : " (now)") : ""}</span>
            </span>
            {s.date && (
              <span className={`text-sm ${s.state === "current" ? "font-semibold" : "text-[var(--muted)]"}`} style={s.state === "current" ? { color: "var(--tone)" } : undefined}>
                {formatDay(s.date, es)}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--muted)]">
        {es
          ? "Los pasos y fechas vienen de lo que USCIS informa. Algunos casos se saltan pasos."
          : "Steps and dates come from what USCIS reports. Some cases skip steps."}
      </p>
    </section>
  );
}

function StepIcon({ state }: { state: "done" | "current" | "upcoming" }) {
  if (state === "done") {
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="flex-none">
        <circle cx="10" cy="10" r="9" fill="var(--tone)" />
        <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === "current") {
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="flex-none">
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--tone)" strokeWidth="2" />
        <circle cx="10" cy="10" r="4.5" fill="var(--tone)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="flex-none">
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2" />
    </svg>
  );
}
