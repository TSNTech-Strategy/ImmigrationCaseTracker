import Link from "next/link";
import type { ReactNode } from "react";
import type { ActivityWindow, Insights } from "@/lib/insights";
import { formatDay } from "@/components/line-map";

const L = {
  en: {
    basedOn: (n: number, form: string) => `Based on ${n.toLocaleString("en-US")} CasePingo cases for Form ${form}.`,
    collecting: (form: string) => `We're still collecting cases for Form ${form}. Numbers appear as more people track cases like this one.`,
    noForm: "Insights appear once USCIS reports this case's form.",
    demo: "Demo data: these numbers come from simulated statuses, not from USCIS.",
    yourCase: "This case so far",
    sinceFiling: "Since filing",
    totalTime: "Total time",
    atStatus: "At this status",
    finished: "Finished",
    days: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`,
    cases: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "case" : "cases"}`,
    next: "What usually comes next",
    nextAfter: (s: string) => `After “${s}”`,
    nextCases: (n: number) => `Of ${n.toLocaleString("en-US")} CasePingo cases that moved on from this status, the next update was:`,
    median: (d: number) => `usually after ${d.toLocaleString("en-US")} ${d === 1 ? "day" : "days"}`,
    guideNext: "What the status library says",
    similar: "Cases filed near this one",
    similarSub: (n: number, w: number) => `${n.toLocaleString("en-US")} cases with the same form, filed within ${w} days. Where they are now:`,
    ahead: (p: number) => `This case is further along than ${p}% of them.`,
    approvedShare: (p: number) => `${p}% of them are already approved.`,
    you: "This case",
    offices: "Time to approval by office",
    officesSub: "Median days from filing to approval, for approvals in the last 2 years.",
    allOffices: (d: number, n: number) => `All offices: ${d.toLocaleString("en-US")} days (${n.toLocaleString("en-US")} cases)`,
    yourOffice: "This case's office",
    rates: "Approvals and evidence requests",
    approved: "Approved",
    approvedOf: (n: number) => `of ${n.toLocaleString("en-US")} decided cases`,
    rfe: "Got an evidence request",
    rfeOf: (n: number) => `of ${n.toLocaleString("en-US")} cases`,
    activity: "Recent updates",
    windows: { "7d": "7 days", "30d": "30 days", "12m": "12 months" } as Record<ActivityWindow, string>,
    activityCases: (n: number) => `${n.toLocaleString("en-US")} cases got an update`,
    trend: "Approvals per month",
    trendSub: (n: number) => `${n.toLocaleString("en-US")} approvals in the last 12 months`,
    table: "Show as a table",
    month: "Month",
    approvals: "Approvals",
    notEnough: (min: number) => `Not enough cases yet. This appears once at least ${min} CasePingo cases like this one are behind it.`,
    official: "Official processing times",
    officialText: (form: string | null, office: string | null) =>
      `USCIS publishes its own processing times.${form ? ` Choose Form ${form}` : ""}${form && office ? ` and “${office}”` : ""}${form ? "." : ""}`,
    officialLink: "USCIS processing times",
    note: "Anonymous totals from personal cases tracked in CasePingo, each case counted once. No one's receipt number or name is shown, and groups smaller than 10 cases stay hidden. Law-firm cases are never included. Not USCIS's official numbers, and not legal advice.",
    locale: "en-US",
  },
  es: {
    basedOn: (n: number, form: string) => `Basado en ${n.toLocaleString("es-US")} casos de CasePingo del Formulario ${form}.`,
    collecting: (form: string) => `Todavía estamos reuniendo casos del Formulario ${form}. Los números aparecen cuando más personas siguen casos como este.`,
    noForm: "El análisis aparece cuando USCIS informa el formulario de este caso.",
    demo: "Datos de demostración: estos números vienen de estados simulados, no de USCIS.",
    yourCase: "Este caso hasta ahora",
    sinceFiling: "Desde la presentación",
    totalTime: "Tiempo total",
    atStatus: "En este estado",
    finished: "Terminó",
    days: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"}`,
    cases: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "caso" : "casos"}`,
    next: "Qué suele venir después",
    nextAfter: (s: string) => `Después de “${s}”`,
    nextCases: (n: number) => `De ${n.toLocaleString("es-US")} casos de CasePingo que pasaron de este estado, la siguiente novedad fue:`,
    median: (d: number) => `por lo general después de ${d.toLocaleString("es-US")} ${d === 1 ? "día" : "días"}`,
    guideNext: "Lo que dice la biblioteca de estados",
    similar: "Casos presentados cerca de esta fecha",
    similarSub: (n: number, w: number) => `${n.toLocaleString("es-US")} casos del mismo formulario, presentados dentro de ${w} días. Dónde están ahora:`,
    ahead: (p: number) => `Este caso va más avanzado que el ${p}% de ellos.`,
    approvedShare: (p: number) => `El ${p}% de ellos ya fue aprobado.`,
    you: "Este caso",
    offices: "Tiempo hasta la aprobación por oficina",
    officesSub: "Mediana de días desde la presentación hasta la aprobación, para aprobaciones de los últimos 2 años.",
    allOffices: (d: number, n: number) => `Todas las oficinas: ${d.toLocaleString("es-US")} días (${n.toLocaleString("es-US")} casos)`,
    yourOffice: "Oficina de este caso",
    rates: "Aprobaciones y solicitudes de evidencia",
    approved: "Aprobados",
    approvedOf: (n: number) => `de ${n.toLocaleString("es-US")} casos con decisión`,
    rfe: "Recibieron una solicitud de evidencia",
    rfeOf: (n: number) => `de ${n.toLocaleString("es-US")} casos`,
    activity: "Novedades recientes",
    windows: { "7d": "7 días", "30d": "30 días", "12m": "12 meses" } as Record<ActivityWindow, string>,
    activityCases: (n: number) => `${n.toLocaleString("es-US")} casos tuvieron una novedad`,
    trend: "Aprobaciones por mes",
    trendSub: (n: number) => `${n.toLocaleString("es-US")} aprobaciones en los últimos 12 meses`,
    table: "Ver como tabla",
    month: "Mes",
    approvals: "Aprobaciones",
    notEnough: (min: number) => `Todavía no hay suficientes casos. Esto aparece cuando al menos ${min} casos de CasePingo como este lo respaldan.`,
    official: "Tiempos oficiales de procesamiento",
    officialText: (form: string | null, office: string | null) =>
      `USCIS publica sus propios tiempos de procesamiento.${form ? ` Elija el Formulario ${form}` : ""}${form && office ? ` y “${office}”` : ""}${form ? "." : ""}`,
    officialLink: "Tiempos de procesamiento de USCIS",
    note: "Totales anónimos de casos personales que se siguen en CasePingo, contando cada caso una sola vez. Nunca se muestra el número de recibo ni el nombre de nadie, y los grupos de menos de 10 casos quedan ocultos. Nunca se incluyen casos de despachos de abogados. No son cifras oficiales de USCIS ni asesoría legal.",
    locale: "es-US",
  },
};

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 id={id} className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function NotEnough({ text }: { text: string }) {
  return <p className="rounded-md bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--muted)]">{text}</p>;
}

/** Ranked shares out of 100%: one hue, label and value as text, a light track under the bar. */
function ShareBars({ rows }: { rows: { key: string; label: string; share: number; sub?: string }[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1.5" title={`${r.label}: ${r.share}%${r.sub ? ` · ${r.sub}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{r.label}</span>
            <span className="font-semibold">{r.share}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded bg-[var(--surface-2)]" aria-hidden="true">
            <div className="h-2.5 rounded-r bg-[var(--chart-accent)]" style={{ width: `${Math.max(1, r.share)}%` }} />
          </div>
          {r.sub && <span className="text-sm text-[var(--muted)]">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Values compared with each other, scaled to the largest; the row that's "this case" in the accent, the rest gray. */
function EmphasisBars({ rows, youLabel }: { rows: { key: string; label: string; value: number; valueText: string; you?: boolean }[]; youLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1.5" title={`${r.label}: ${r.valueText}${r.you ? ` · ${youLabel}` : ""}`}>
          <div className="flex items-center gap-2">
            <span className={`min-w-0 ${r.you ? "font-semibold" : ""}`}>{r.label}</span>
            {r.you && <span className="flex-none rounded-full bg-[var(--chart-accent)] px-2 py-px text-[11px] font-extrabold text-white">{youLabel}</span>}
            <span className="ml-auto flex-none font-semibold">{r.valueText}</span>
          </div>
          <div className="h-2.5" aria-hidden="true">
            {r.value > 0 && (
              <div className={`h-2.5 rounded-r ${r.you ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One ratio against 100%: status color with an icon and words, on a lighter track. */
function Meter({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: "done" | "action" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-black text-[var(--surface)]" style={{ background: `var(--st-${tone})` }}>
          {tone === "done" ? "✓" : "!"}
        </span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-2xl font-extrabold">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: `var(--st-${tone}-bg)` }} aria-hidden="true">
        <div className="h-2.5 rounded-full" style={{ width: `${Math.max(1, value)}%`, background: `var(--st-${tone})` }} />
      </div>
      <span className="text-sm text-[var(--muted)]">{sub}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg bg-[var(--surface-2)] px-4 py-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-2xl font-extrabold tracking-tight">{value}</span>
    </div>
  );
}

/** Approvals per month: one series of columns, the latest month highlighted, hover for each value, plus a table. */
function MonthColumns({ months, t }: { months: { month: string; approvals: number }[]; t: (typeof L)["en"] }) {
  const max = Math.max(1, ...months.map((m) => m.approvals));
  const fmt = (m: string, month: "short" | "long") =>
    new Intl.DateTimeFormat(t.locale, { month, year: month === "long" ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const last = months.length - 1;
  const peak = months.reduce((best, m, i) => (m.approvals > months[best].approvals ? i : best), 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-32 items-end gap-0.5 border-b border-[var(--border)]" role="img" aria-label={months.map((m) => `${fmt(m.month, "long")}: ${m.approvals}`).join(", ")}>
        {months.map((m, i) => (
          <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${fmt(m.month, "long")}: ${m.approvals}`}>
            {(i === last || i === peak) && m.approvals > 0 && <span className="text-xs font-semibold">{m.approvals.toLocaleString(t.locale)}</span>}
            {m.approvals > 0 && (
              <div
                className={`w-[70%] max-w-6 rounded-t ${i === last ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`}
                style={{ height: `${Math.max(3, (m.approvals / max) * 100 * 0.82)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5" aria-hidden="true">
        {months.map((m) => (
          <span key={m.month} className="flex-1 truncate text-center text-[11px] text-[var(--muted)]">
            {fmt(m.month, "short").replace(".", "")}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted)] underline underline-offset-2">{t.table}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="py-1 font-medium">{t.month}</th>
              <th className="py-1 text-right font-medium">{t.approvals}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-[var(--border)]">
                <td className="py-1">{fmt(m.month, "long")}</td>
                <td className="py-1 text-right tabular-nums">{m.approvals.toLocaleString(t.locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** How a case compares with CasePingo cases like it (server-rendered; the activity window comes from the URL). */
export function CaseInsights({ data, es, window, windowHref }: { data: Insights; es: boolean; window: ActivityWindow; windowHref: (w: ActivityWindow) => string }) {
  const lang = es ? "es" : "en";
  const t = L[lang];
  const notEnough = t.notEnough(data.minGroup);
  const form = data.form?.code ?? null;
  const you = data.yourCase;
  const officeName = you.office ? (you.office.name ? `${you.office.name[lang]} (${you.office.code})` : you.office.code) : null;
  const activity = data.activity.find((a) => a.window === window) ?? data.activity[1];
  return (
    <div className="flex flex-col gap-5">
      {data.mode !== "production" && (
        <p role="note" className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
          {t.demo}
        </p>
      )}
      <p className="text-[var(--muted)]">{!form ? t.noForm : data.poolSize ? t.basedOn(data.poolSize, form) : t.collecting(form)}</p>

      <Card id="ins-you" title={t.yourCase}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <StatTile label={you.finished ? t.totalTime : t.sinceFiling} value={you.days !== null ? t.days(you.days) : "—"} />
          {you.finished ? (
            <StatTile label={t.finished} value={formatDay(you.lastUpdate, es)} />
          ) : (
            <StatTile label={t.atStatus} value={you.daysAtStatus !== null ? t.days(you.daysAtStatus) : "—"} />
          )}
        </div>
      </Card>

      <Card id="ins-next" title={t.next}>
        {you.status && <p className="text-lg font-semibold">{t.nextAfter(you.status[lang])}</p>}
        {data.next ? (
          <>
            <p className="text-sm text-[var(--muted)]">{t.nextCases(data.next.cases)}</p>
            <ShareBars rows={data.next.options.map((o) => ({ key: o.title.en, label: o.title[lang], share: o.share, sub: o.medianDays !== null ? t.median(o.medianDays) : undefined }))} />
          </>
        ) : (
          !you.finished && <NotEnough text={notEnough} />
        )}
        {data.guideNext && (
          <div className="flex flex-col gap-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.guideNext}</h3>
            <p className="leading-relaxed">{data.guideNext[lang]}</p>
          </div>
        )}
      </Card>

      <Card id="ins-similar" title={t.similar}>
        {data.similar ? (
          <>
            <p className="text-sm text-[var(--muted)]">{t.similarSub(data.similar.cases, data.similarWindowDays)}</p>
            <EmphasisBars youLabel={t.you} rows={data.similar.steps.map((s) => ({ key: s.key, label: s.label[lang], value: s.cases, valueText: s.cases.toLocaleString(t.locale), you: s.you }))} />
            <p className="font-semibold">{t.ahead(data.similar.aheadOf)}</p>
            <p className="text-sm text-[var(--muted)]">{t.approvedShare(data.similar.approvedShare)}</p>
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-offices" title={t.offices}>
        {data.offices ? (
          <>
            <p className="text-sm text-[var(--muted)]">{t.officesSub}</p>
            {data.offices.rows.length > 0 && (
              <EmphasisBars
                youLabel={t.yourOffice}
                rows={data.offices.rows.map((r) => ({ key: r.code, label: r.name ? `${r.code} · ${r.name[lang]}` : r.code, value: r.medianDays, valueText: t.days(r.medianDays), you: r.yours }))}
              />
            )}
            {data.offices.overallMedianDays !== null && <p className="text-sm">{t.allOffices(data.offices.overallMedianDays, data.offices.cases)}</p>}
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-rates" title={t.rates}>
        {data.rates ? (
          <div className="flex flex-col gap-5">
            {data.rates.approval && <Meter tone="done" label={t.approved} value={data.rates.approval.rate} sub={t.approvedOf(data.rates.approval.decided)} />}
            {data.rates.rfe && <Meter tone="action" label={t.rfe} value={data.rates.rfe.rate} sub={t.rfeOf(data.rates.rfe.cases)} />}
          </div>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-activity" title={t.activity}>
        <nav aria-label={t.activity} className="flex gap-1 self-start rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {(["7d", "30d", "12m"] as const).map((w) => (
            <Link
              key={w}
              href={windowHref(w)}
              scroll={false}
              aria-current={w === window ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${w === window ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
            >
              {t.windows[w]}
            </Link>
          ))}
        </nav>
        {activity.cases !== null ? (
          <>
            <p className="text-sm text-[var(--muted)]">{t.activityCases(activity.cases)}</p>
            <ShareBars rows={activity.kinds.map((k) => ({ key: k.key, label: k.label[lang], share: k.share, sub: t.cases(k.cases) }))} />
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-trend" title={t.trend}>
        {data.trend ? (
          <>
            <p className="text-sm text-[var(--muted)]">{t.trendSub(data.trend.total)}</p>
            <MonthColumns months={data.trend.months} t={t} />
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-official" title={t.official}>
        <p className="text-sm">
          {t.officialText(form, officeName)}{" "}
          <a href={data.processingTimesUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
            {t.officialLink}
          </a>
        </p>
      </Card>

      <p className="text-xs text-[var(--muted)]">{t.note}</p>
    </div>
  );
}

/** The link from a case page to its insights. */
export function InsightsLink({ href, es }: { href: string; es: boolean }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">{es ? "Cómo va este caso comparado con otros" : "How this case compares"}</span>
          <span className="text-sm text-[var(--muted)]">
            {es ? "Tiempos, próximos pasos y casos presentados cerca de su fecha." : "Times, next steps and cases filed near this one, from CasePingo cases like it."}
          </span>
        </span>
      </span>
      <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
