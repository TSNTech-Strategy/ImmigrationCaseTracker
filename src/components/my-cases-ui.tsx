import Link from "next/link";
import type { CaseFilter, JourneyShare } from "@/lib/my-cases";
import { TILE_FILTERS } from "@/lib/my-cases";
import { COURT_GUIDE, COURT_REVIEWED } from "@/lib/court";
import { formatDay } from "@/components/line-map";

type Lang = "en" | "es";

export function TrophyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h2.5a2.5 2.5 0 0 1-2.8 3.5M7 6H4.5a2.5 2.5 0 0 0 2.8 3.5" />
    </svg>
  );
}

/** "30%" in a small ring: how many of the checklist's required documents are ticked. */
export function ReadyRing({ pct, size = 28 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const len = 2 * Math.PI * r;
  const color = pct >= 100 ? "var(--success)" : pct > 0 ? "var(--accent)" : "var(--st-stop)";
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={pct > 0 ? `${(len * Math.min(pct, 100)) / 100} ${len}` : `${len} 0`} strokeOpacity={pct > 0 ? 1 : 0.6} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

/** USCIS cases | Immigration court, above the list. */
export function CasesTabs({ current, es = false }: { current: "uscis" | "court"; es?: boolean }) {
  const tab = (key: "uscis" | "court", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${current === key ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label={es ? "Tipo de caso" : "Kind of case"} className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
      {tab("uscis", "/cases", es ? "Casos de USCIS" : "USCIS cases")}
      {tab("court", "/cases/court", es ? "Corte de inmigración" : "Immigration court")}
    </nav>
  );
}

export const TILE_LABEL: Record<CaseFilter, { en: string; es: string }> = {
  attention: { en: "Need attention", es: "Requieren atención" },
  interview: { en: "Interview cases", es: "Con entrevista" },
  approved: { en: "Approved recently", es: "Aprobados hace poco" },
  active: { en: "Active cases", es: "Casos activos" },
  completed: { en: "Completed", es: "Terminados" },
};

const TILE_ICON: Record<(typeof TILE_FILTERS)[number], { d: string[]; fg: string; bg: string }> = {
  attention: { d: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v5", "M12 16h.01"], fg: "var(--st-action)", bg: "var(--st-action-bg)" },
  interview: {
    d: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
    fg: "var(--foreground)",
    bg: "var(--surface-2)",
  },
  approved: { d: ["M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z", "M8.5 12l2.5 2.5 4.5-5"], fg: "var(--success)", bg: "var(--success-soft)" },
  active: { d: ["M6 2h12", "M6 22h12", "M7 2v4l5 6-5 6v4", "M17 2v4l-5 6 5 6v4"], fg: "var(--accent)", bg: "var(--accent-soft)" },
};

/** Four tiles with counts; each one shows only those cases (click again for all). */
export function SummaryTiles({ counts, active, hrefFor, es = false }: { counts: Record<CaseFilter, number>; active: CaseFilter | null; hrefFor: (f: CaseFilter | null) => string; es?: boolean }) {
  const lang: Lang = es ? "es" : "en";
  return (
    <nav aria-label={es ? "Sus casos de un vistazo" : "Your cases at a glance"}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILE_FILTERS.map((f) => {
          const on = active === f;
          const icon = TILE_ICON[f];
          return (
            <li key={f}>
              <Link
                href={hrefFor(on ? null : f)}
                aria-current={on ? "true" : undefined}
                className={`flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color: icon.fg, background: icon.bg }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {icon.d.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                  <span className="text-2xl font-bold tabular-nums leading-none">{counts[f]}</span>
                </span>
                <span className={`text-sm font-medium leading-snug ${on ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{TILE_LABEL[f][lang]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** An approved case on its page: the approval day, how long it took, and the way to the Journey approved page (where it's shared). */
export function ShareJourneyCard({ share, formCode, href, es = false }: { share: JourneyShare; formCode: string | null; href: string; es?: boolean }) {
  return (
    <section aria-labelledby="share-h" className="relative flex flex-col gap-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--brand-red),var(--accent))]" />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">{es ? "Su trayectoria" : "Your journey"}</p>
          <h2 id="share-h" className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {es ? "Aprobado" : "Approved"}
            {formCode && <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-sm font-bold text-[var(--accent)]">{formCode}</span>}
          </h2>
          {share.approvedOn && <p className="font-semibold">{es ? `Aprobado el ${formatDay(share.approvedOn, true)}` : `Approved on ${formatDay(share.approvedOn, false)}`}</p>}
          {share.days !== null && (
            <p className="text-sm text-[var(--muted)]">
              {share.days.toLocaleString(es ? "es-US" : "en-US")} {es ? (share.days === 1 ? "día" : "días") : share.days === 1 ? "day" : "days"}{" "}
              {es ? "desde la presentación hasta la aprobación" : "from filing to approval"}
            </p>
          )}
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#d9a632] bg-[#f2c14e] px-5 py-2.5 font-extrabold text-[#0f1b2d] hover:bg-[#e0ae3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <TrophyIcon />
          {es ? "Compartir mi trayectoria" : "Share my journey"}
        </Link>
        <p className="text-xs text-[var(--muted)]">{es ? "No se incluye su número de recibo." : "Your receipt number isn't included."}</p>
      </div>
    </section>
  );
}

/** The immigration court guide: EOIR's own tools, tips and official links. */
export function CourtGuide({ es = false, headingLevel = 2 }: { es?: boolean; headingLevel?: 1 | 2 }) {
  const lang: Lang = es ? "es" : "en";
  const g = COURT_GUIDE;
  const Title = headingLevel === 1 ? "h1" : "h2";
  const Sub = headingLevel === 1 ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Title className={headingLevel === 1 ? "text-3xl font-bold tracking-tight sm:text-4xl" : "text-xl font-semibold tracking-tight"}>{g.title[lang]}</Title>
        <p className="max-w-3xl leading-relaxed text-[var(--muted)]">{g.intro[lang]}</p>
      </div>
      <div className="rounded-lg border border-[var(--accent-soft)] bg-[var(--accent-soft)] p-5">
        <Sub className="font-semibold">{g.aNumber.title[lang]}</Sub>
        <p className="mt-1 text-sm leading-relaxed">{g.aNumber.text[lang]}</p>
      </div>
      <section aria-labelledby="court-ways-h" className="flex flex-col gap-3">
        <Sub id="court-ways-h" className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          {es ? "Cómo consultar su caso en la corte" : "How to check your court case"}
        </Sub>
        <div className="grid gap-4 sm:grid-cols-2">
          {g.ways.map((w) => (
            <div key={w.key} className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="font-semibold">{w.title[lang]}</p>
              <p className="text-sm leading-relaxed">{w.text[lang]}</p>
              <a
                href={w.link.url}
                {...(w.link.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`mt-auto inline-flex items-center justify-center gap-1 self-start rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${w.key === "online" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "border border-[var(--border)] bg-[var(--surface)]"}`}
              >
                {w.link.label[lang]}
                {w.link.url.startsWith("http") && <span aria-hidden="true">↗</span>}
                {w.link.url.startsWith("http") && <span className="sr-only">{es ? "(se abre en una pestaña nueva)" : "(opens in a new tab)"}</span>}
              </a>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="court-tips-h" className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <Sub id="court-tips-h" className="font-semibold">
          {es ? "Tenga en cuenta" : "Good to know"}
        </Sub>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {g.tips.map((tip) => (
            <li key={tip.en}>{tip[lang]}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="court-links-h" className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <Sub id="court-links-h" className="font-semibold">
          {es ? "Páginas oficiales de EOIR" : "Official EOIR pages"}
        </Sub>
        <ul className="flex flex-col gap-2 text-sm">
          {g.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
                {l.label[lang]} <span aria-hidden="true">↗</span>
                <span className="sr-only">{es ? "(se abre en una pestaña nueva)" : "(opens in a new tab)"}</span>
              </a>
              {l.text && <p className="text-[var(--muted)]">{l.text[lang]}</p>}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-[var(--muted)]">
        {g.note[lang]} {es ? `Revisado con las páginas de EOIR el ${formatDay(COURT_REVIEWED, true)}.` : `Checked against EOIR's pages on ${formatDay(COURT_REVIEWED, false)}.`}
      </p>
    </div>
  );
}
