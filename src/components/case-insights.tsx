import Link from "next/link";
import type { ReactNode } from "react";
import type { ActivityWindow, Insights } from "@/lib/insights";
import { formatDay } from "@/components/line-map";

/**
 * Case analysis on the website. The sections follow Lawfully's Analysis screens (monthly
 * approvals, similar cases, today's update, time by receipt number, processing time, next
 * message, approval & RFE rate, processing trend), built from CasePingo's own anonymous
 * totals and drawn in CasePingo's style. Server-rendered: the window, highlighted category
 * and office come from the URL, and "See more" parts use <details>.
 */

const L = {
  en: {
    locale: "en-US",
    demo: "Demo data: these numbers come from simulated statuses, not from USCIS.",
    noForm: "Insights appear once USCIS reports this case's form.",
    notEnough: (min: number) => `Not enough cases yet. This appears once at least ${min} CasePingo cases like this one are behind it.`,
    monthly: "Monthly approvals",
    monthlySub: "See how approval speed compares to last month.",
    monthlyHelp: "Approvals CasePingo saw for this form, added up day by day: this month so far against all of last month.",
    monthLast: (m: string, n: string) => `Last month (${m}): ${n}`,
    monthThis: (m: string, n: string) => `This month (${m}): ${n}`,
    similarHeading: (form: string) => `${form}s similar to the filed date`,
    ranking: "Case ranking",
    rankingText: "How fast is this case moving? Compare with similar cases filed near its date.",
    rankingLabel: "This case's ranking",
    rank: (n: number, of: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")} of ${of}`,
    seeDetails: "See details",
    similarSub: (n: number, w: number) => `${n.toLocaleString("en-US")} cases with the same form, filed within ${w} days. Where they are now:`,
    ahead: (p: number) => `This case is further along than ${p}% of them.`,
    approvedShare: (p: number) => `${p}% of them are already approved.`,
    similarCount: (n: number) => `There are ${n.toLocaleString("en-US")} similar cases.`,
    you: "This case",
    stats: (form: string) => `Statistical analysis for ${form}`,
    updated: (d: string) => `Last update ${d}`,
    updates: { day: "Today's update", month: "This month's updates", year: "This year's updates" } as Record<ActivityWindow, string>,
    windows: { day: "Daily", month: "Monthly", year: "Yearly" } as Record<ActivityWindow, string>,
    total: (n: number) => `Total cases: ${n.toLocaleString("en-US")}`,
    pick: "Pick a row to highlight it in the chart.",
    seeMore: "See more",
    receipt: "Average time to approval by receipt number",
    receiptHelp: "The first three letters of a receipt number show the USCIS office that received the case. These are median days from filing to approval for CasePingo cases approved in the last 2 years.",
    allOffices: (d: number, n: number) => `All offices: ${d.toLocaleString("en-US")} days (${n.toLocaleString("en-US")} cases)`,
    yourOffice: "This case's office",
    processing: "USCIS processing time",
    processingPick: "Choose a service center to see how long CasePingo cases took.",
    aboutMonths: (m: number) => `about ${m} ${m === 1 ? "month" : "months"}`,
    processingBasis: (n: number) => `Median for ${n.toLocaleString("en-US")} CasePingo cases approved in the last 2 years.`,
    official: "See USCIS's official time",
    officialText: (form: string | null, office: string | null) =>
      `USCIS publishes its own processing times.${form ? ` Choose Form ${form}` : ""}${form && office ? ` and “${office}”` : ""}${form ? "." : ""}`,
    next: "What message will you get next?",
    nextSub: "Most likely next update, based on the current message.",
    probability: "Probability",
    avgTime: "Avg time",
    nextOthers: "Other possible next updates",
    nextBasis: (n: number) => `From ${n.toLocaleString("en-US")} CasePingo cases that moved on from this message.`,
    guideNext: "What the status library says",
    rates: "Approval & RFE rate",
    ratesText: (form: string, decided: number, approval: number, rfe: number | null) =>
      `Of ${decided.toLocaleString("en-US")} decided ${form} cases in CasePingo, ${approval}% were approved.${rfe !== null ? ` ${rfe}% of cases got a request for evidence (RFE).` : ""}`,
    rfeOnly: (rfe: number, n: number) => `${rfe}% of ${n.toLocaleString("en-US")} CasePingo cases got a request for evidence (RFE).`,
    approval: "Approval",
    rfe: "RFE",
    trend: "Case processing trend",
    trendHelp: "Approvals, evidence requests (RFE) and denials USCIS reported each month for CasePingo cases of this form.",
    approved: "Approved",
    denied: "Denied",
    month: "Month",
    table: "Show as a table",
    days: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`,
    note: "Anonymous totals from personal cases tracked in CasePingo, each case counted once. No one's receipt number or name is shown, and groups smaller than 10 cases stay hidden. Law-firm cases are never included. Not USCIS's official numbers, and not legal advice.",
  },
  es: {
    locale: "es-US",
    demo: "Datos de demostración: estos números vienen de estados simulados, no de USCIS.",
    noForm: "El análisis aparece cuando USCIS informa el formulario de este caso.",
    notEnough: (min: number) => `Todavía no hay suficientes casos. Esto aparece cuando al menos ${min} casos de CasePingo como este lo respaldan.`,
    monthly: "Aprobaciones del mes",
    monthlySub: "Compare la velocidad de aprobación con el mes pasado.",
    monthlyHelp: "Aprobaciones que CasePingo vio para este formulario, sumadas día a día: lo que va de este mes frente a todo el mes pasado.",
    monthLast: (m: string, n: string) => `Mes pasado (${m}): ${n}`,
    monthThis: (m: string, n: string) => `Este mes (${m}): ${n}`,
    similarHeading: (form: string) => `Casos ${form} presentados cerca de la misma fecha`,
    ranking: "Posición del caso",
    rankingText: "¿Qué tan rápido avanza este caso? Compárelo con casos parecidos presentados cerca de su fecha.",
    rankingLabel: "Posición de este caso",
    rank: (n: number, of: number) => `${n}.º de ${of}`,
    seeDetails: "Ver detalles",
    similarSub: (n: number, w: number) => `${n.toLocaleString("es-US")} casos del mismo formulario, presentados dentro de ${w} días. Dónde están ahora:`,
    ahead: (p: number) => `Este caso va más avanzado que el ${p}% de ellos.`,
    approvedShare: (p: number) => `El ${p}% de ellos ya fue aprobado.`,
    similarCount: (n: number) => `Hay ${n.toLocaleString("es-US")} casos parecidos.`,
    you: "Este caso",
    stats: (form: string) => `Análisis estadístico del ${form}`,
    updated: (d: string) => `Última actualización: ${d}`,
    updates: { day: "Novedades de hoy", month: "Novedades del mes", year: "Novedades del año" } as Record<ActivityWindow, string>,
    windows: { day: "Diario", month: "Mensual", year: "Anual" } as Record<ActivityWindow, string>,
    total: (n: number) => `Total de casos: ${n.toLocaleString("es-US")}`,
    pick: "Elija una fila para resaltarla en el gráfico.",
    seeMore: "Ver más",
    receipt: "Tiempo promedio hasta la aprobación por número de recibo",
    receiptHelp: "Las tres primeras letras del número de recibo indican la oficina de USCIS que recibió el caso. Son medianas de días desde la presentación hasta la aprobación, para casos de CasePingo aprobados en los últimos 2 años.",
    allOffices: (d: number, n: number) => `Todas las oficinas: ${d.toLocaleString("es-US")} días (${n.toLocaleString("es-US")} casos)`,
    yourOffice: "Oficina de este caso",
    processing: "Tiempo de procesamiento de USCIS",
    processingPick: "Elija un centro de servicio para ver cuánto tardaron los casos de CasePingo.",
    aboutMonths: (m: number) => `unos ${m} ${m === 1 ? "mes" : "meses"}`,
    processingBasis: (n: number) => `Mediana de ${n.toLocaleString("es-US")} casos de CasePingo aprobados en los últimos 2 años.`,
    official: "Ver el tiempo oficial de USCIS",
    officialText: (form: string | null, office: string | null) =>
      `USCIS publica sus propios tiempos de procesamiento.${form ? ` Elija el Formulario ${form}` : ""}${form && office ? ` y “${office}”` : ""}${form ? "." : ""}`,
    next: "¿Qué mensaje recibirá después?",
    nextSub: "La siguiente novedad más probable, según el mensaje actual.",
    probability: "Probabilidad",
    avgTime: "Tiempo promedio",
    nextOthers: "Otras novedades posibles",
    nextBasis: (n: number) => `De ${n.toLocaleString("es-US")} casos de CasePingo que pasaron de este mensaje.`,
    guideNext: "Lo que dice la biblioteca de estados",
    rates: "Tasa de aprobación y de RFE",
    ratesText: (form: string, decided: number, approval: number, rfe: number | null) =>
      `De ${decided.toLocaleString("es-US")} casos ${form} de CasePingo con decisión, el ${approval}% fue aprobado.${rfe !== null ? ` El ${rfe}% de los casos recibió una solicitud de evidencia (RFE).` : ""}`,
    rfeOnly: (rfe: number, n: number) => `El ${rfe}% de ${n.toLocaleString("es-US")} casos de CasePingo recibió una solicitud de evidencia (RFE).`,
    approval: "Aprobación",
    rfe: "RFE",
    trend: "Tendencia de procesamiento",
    trendHelp: "Aprobaciones, solicitudes de evidencia (RFE) y negaciones que USCIS informó cada mes para casos de CasePingo de este formulario.",
    approved: "Aprobados",
    denied: "Negados",
    month: "Mes",
    table: "Ver como tabla",
    days: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"}`,
    note: "Totales anónimos de casos personales que se siguen en CasePingo, contando cada caso una sola vez. Nunca se muestra el número de recibo ni el nombre de nadie, y los grupos de menos de 10 casos quedan ocultos. Nunca se incluyen casos de despachos de abogados. No son cifras oficiales de USCIS ni asesoría legal.",
  },
};
type T = (typeof L)["en"];

const monthName = (ym: string, t: T, style: "short" | "long" = "short", withYear = false) =>
  new Intl.DateTimeFormat(t.locale, { month: style, year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)).replace(".", "");

function Icon({ d }: { d: string }) {
  return (
    <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}
const ICONS = {
  monthly: "M3 17l6-6 4 4 8-8M14 7h7v7",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  receipt: "M4 7h16M4 12h10M4 17h7",
  clock: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check: "M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  trend: "M3 21h18M5 21V10M10 21V4M15 21v-7M20 21V8",
};

function Card({ id, icon, title, sub, help, children }: { id: string; icon?: string; title: string; sub?: string; help?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start gap-3">
        {icon && <Icon d={icon} />}
        <div className="flex flex-1 flex-col gap-0.5">
          <h2 id={id} className="text-lg font-semibold leading-snug">
            {title}
          </h2>
          {sub && <p className="text-sm text-[var(--muted)]">{sub}</p>}
        </div>
        {help && (
          <details className="group relative">
            <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-extrabold text-[var(--muted)]" aria-label={help}>
              ?
            </summary>
            <p className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)] shadow-lg">{help}</p>
          </details>
        )}
      </div>
      {children}
    </section>
  );
}

function NotEnough({ text }: { text: string }) {
  return <p className="rounded-md bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--muted)]">{text}</p>;
}

/** Approvals added up day by day: this month (accent, up to today) against all of last month (gray). */
function MonthlyChart({ m, t }: { m: NonNullable<Insights["monthly"]>; t: T }) {
  const W = 640;
  const H = 180;
  const top = 28;
  const bottom = 14;
  const right = 48;
  const days = Math.max(m.daysInMonth, m.last.length);
  const max = Math.max(1, m.lastTotal, m.thisTotal);
  const x = (d: number) => 4 + ((d - 1) / Math.max(1, days - 1)) * (W - 4 - right);
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
  const mon = monthName(m.month, t);
  const n = (v: number) => v.toLocaleString(t.locale);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--chart-muted)]" />
          {t.monthLast(monthName(m.lastMonth, t), n(m.lastTotal))}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--chart-accent)]" />
          {t.monthThis(mon, n(m.thisTotal))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${t.monthThis(mon, n(m.thisTotal))}. ${t.monthLast(monthName(m.lastMonth, t), n(m.lastTotal))}.`}>
        <rect x="4" y={H - bottom} width={W - 4 - right} height="1" fill="var(--border)" />
        <polyline points={pts(m.last)} fill="none" stroke="var(--chart-muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={pts(m.thisMonth)} fill="none" stroke="var(--chart-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <rect x={x(m.last.length) - 30} y={y(m.lastTotal) - 26} width="44" height="20" rx="6" fill="var(--surface-2)" />
        <text x={x(m.last.length) - 8} y={y(m.lastTotal) - 12} fontSize="12" fontWeight="700" fill="var(--foreground)" textAnchor="middle">
          {n(m.lastTotal)}
        </text>
        <circle cx={x(m.today)} cy={y(m.thisTotal)} r="6" fill="var(--surface)" />
        <circle cx={x(m.today)} cy={y(m.thisTotal)} r="4" fill="var(--chart-accent)">
          <title>{t.monthThis(mon, n(m.thisTotal))}</title>
        </circle>
        <text x={x(m.today)} y={y(m.thisTotal) - 11} fontSize="12" fontWeight="700" fill="var(--foreground)" textAnchor="middle">
          {n(m.thisTotal)}
        </text>
      </svg>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>
          {mon} 1
        </span>
        <span className="font-semibold text-[var(--foreground)]">
          {mon} {m.today}
        </span>
        <span>
          {mon} {m.daysInMonth}
        </span>
      </div>
    </div>
  );
}

const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
function slicePath(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a1);
  const [x2, y2] = polar(cx, cy, r, a1);
  const [x3, y3] = polar(cx, cy, r, a0);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Part-to-whole donut: the picked slice in the accent with its share in a bubble, the rest gray, a label in the middle. */
function Donut({ slices, picked, center }: { slices: { key: string; label: string; share: number; value: number }[]; picked: string; center: string }) {
  const S = 240;
  const R = S / 2 - 4;
  const r = R * 0.52;
  const c = S / 2;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const before = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + s.value, 0));
  const arcs = slices.map((s, i) => {
    const a0 = -Math.PI / 2 + (before[i] / total) * Math.PI * 2;
    return { ...s, a0, a1: a0 + (s.value / total) * Math.PI * 2 };
  });
  const sel = arcs.find((s) => s.key === picked) ?? arcs[0];
  const [bx, by] = sel ? polar(c, c, R * 0.92, (sel.a0 + sel.a1) / 2) : [c, c];
  return (
    <div className="relative mx-auto" style={{ width: S, height: S }}>
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img" aria-label={slices.map((s) => `${s.label}: ${s.share}%`).join(", ")}>
        {arcs.length === 1 ? (
          <circle cx={c} cy={c} r={(R + r) / 2} stroke="var(--chart-accent)" strokeWidth={R - r} fill="none" />
        ) : (
          arcs.map((s) => (
            <path key={s.key} d={slicePath(c, c, R, r, s.a0, s.a1)} fill={s.key === sel?.key ? "var(--chart-accent)" : "var(--chart-muted)"} stroke="var(--surface)" strokeWidth="2">
              <title>{`${s.label}: ${s.share}% (${s.value})`}</title>
            </path>
          ))
        )}
        <text x={c} y={c + 6} fontSize="18" fontWeight="800" fill="var(--foreground)" textAnchor="middle">
          {center}
        </text>
      </svg>
      {sel && (
        <div
          className="pointer-events-none absolute flex w-28 flex-col items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-2 shadow-lg"
          style={{ left: Math.min(Math.max(0, bx - 56), S - 112), top: Math.min(Math.max(0, by - 30), S - 60) }}
        >
          <span className="max-w-full truncate text-[11px]">{sel.label}</span>
          <span className="text-lg font-extrabold">{sel.share}%</span>
        </div>
      )}
    </div>
  );
}

function Ring({ value, label, tone }: { value: number; label: string; tone: "done" | "action" }) {
  const S = 120;
  const stroke = 12;
  const rr = (S - stroke) / 2;
  const circ = 2 * Math.PI * rr;
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="font-semibold">{label}</span>
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img" aria-label={`${label}: ${value}%`}>
        <circle cx={S / 2} cy={S / 2} r={rr} stroke={`var(--st-${tone}-bg)`} strokeWidth={stroke} fill="none" />
        <circle
          cx={S / 2}
          cy={S / 2}
          r={rr}
          stroke={`var(--st-${tone})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${S / 2} ${S / 2})`}
        />
        <text x={S / 2} y={S / 2 + 8} fontSize="24" fontWeight="800" fill="var(--foreground)" textAnchor="middle">
          {value}%
        </text>
      </svg>
    </div>
  );
}

/** Case analysis for one case. `href` builds links that change the window, highlighted category or office. */
export function CaseInsights({
  data,
  es,
  window: winParam,
  kind,
  office: officeParam,
  href,
}: {
  data: Insights;
  es: boolean;
  window: ActivityWindow | null;
  kind: string | null;
  office: string | null;
  href: (p: { window?: ActivityWindow; kind?: string; office?: string }, anchor: string) => string;
}) {
  const lang = es ? "es" : "en";
  const t = L[lang];
  const n = (x: number) => x.toLocaleString(t.locale);
  const notEnough = t.notEnough(data.minGroup);
  const form = data.form?.code ?? null;
  const you = data.yourCase;

  const win = winParam ?? data.activity.find((a) => a.cases !== null)?.window ?? "day";
  const activity = data.activity.find((a) => a.window === win) ?? data.activity[0];
  const slices = activity.kinds.map((k) => ({ key: k.key, label: k.label[lang], share: k.share, value: k.cases }));
  const picked = kind && slices.some((s) => s.key === kind) ? kind : (slices[0]?.key ?? "");
  const center =
    win === "day"
      ? new Intl.DateTimeFormat(t.locale, { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }).format(new Date(`${activity.from}T00:00:00Z`)).replace(".", "")
      : win === "month"
        ? monthName(activity.from.slice(0, 7), t, "short", true)
        : activity.from.slice(0, 4);

  const offices = data.offices?.rows ?? [];
  const office = offices.find((o) => o.code === officeParam) ?? offices.find((o) => o.yours) ?? offices[0];
  const officeName = you.office ? (you.office.name ? `${you.office.name[lang]} (${you.office.code})` : you.office.code) : null;
  const officeMax = Math.max(1, ...offices.map((o) => o.medianDays));
  const next = data.next;
  const top = next?.options[0];
  const trendMax = Math.max(1, ...(data.trend?.months ?? []).map((m) => m.approved + m.evidence + m.denied));

  return (
    <div className="flex flex-col gap-5">
      {data.mode !== "production" && (
        <p role="note" className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
          {t.demo}
        </p>
      )}
      {!form && <NotEnough text={t.noForm} />}

      <Card id="ins-monthly" icon={ICONS.monthly} title={t.monthly} sub={t.monthlySub} help={t.monthlyHelp}>
        {data.monthly ? <MonthlyChart m={data.monthly} t={t} /> : <NotEnough text={notEnough} />}
      </Card>

      {form && (
        <>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{t.similarHeading(form)}</h2>
          <section aria-label={t.ranking} className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            {data.similar ? (
              <>
                <div className="flex gap-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <h3 className="font-semibold">{t.ranking}</h3>
                    <p className="text-lg leading-snug">{t.rankingText}</p>
                  </div>
                  <div className="flex w-44 flex-none flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.rankingLabel}</span>
                    {(() => {
                      const steps = data.similar!.steps;
                      const me = Math.max(0, steps.findIndex((s) => s.you));
                      const start = Math.max(0, Math.min(me - 1, steps.length - 4));
                      const rows = steps.slice(start, start + 4);
                      const max = Math.max(1, ...rows.map((r) => r.cases));
                      return rows.map((r) => (
                        <div key={r.key} className="flex items-center gap-1.5" title={`${r.label[lang]}: ${r.cases}`}>
                          <div className="h-2 w-16 flex-none overflow-hidden rounded bg-[var(--surface-2)]">
                            <div className={`h-2 rounded ${r.you ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`} style={{ width: `${Math.max(6, (r.cases / max) * 100)}%` }} />
                          </div>
                          {r.you && <span className="whitespace-nowrap rounded-full bg-[var(--chart-accent)] px-2 text-[11px] font-extrabold text-white">{t.you}</span>}
                        </div>
                      ));
                    })()}
                    <span className="self-start rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-sm font-extrabold">⚡ {t.rank(data.similar.rank, data.similar.of)}</span>
                  </div>
                </div>
                <details className="group">
                  <summary className="cursor-pointer list-none rounded-xl bg-[var(--accent)] px-4 py-3 text-center font-semibold text-[var(--on-accent,#fff)]">{t.seeDetails}</summary>
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="text-sm text-[var(--muted)]">{t.similarSub(data.similar.cases, data.similarWindowDays)}</p>
                    <ul className="flex flex-col gap-3">
                      {(() => {
                        const max = Math.max(1, ...data.similar!.steps.map((s) => s.cases));
                        return data.similar!.steps.map((s) => (
                          <li key={s.key} className="flex flex-col gap-1.5" title={`${s.label[lang]}: ${s.cases}`}>
                            <div className="flex items-center gap-2">
                              <span className={s.you ? "font-semibold" : ""}>{s.label[lang]}</span>
                              {s.you && <span className="rounded-full bg-[var(--chart-accent)] px-2 py-px text-[11px] font-extrabold text-white">{t.you}</span>}
                              <span className="ml-auto font-semibold">{n(s.cases)}</span>
                            </div>
                            <div className="h-2.5" aria-hidden="true">
                              {s.cases > 0 && <div className={`h-2.5 rounded-r ${s.you ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`} style={{ width: `${Math.max(2, (s.cases / max) * 100)}%` }} />}
                            </div>
                          </li>
                        ));
                      })()}
                    </ul>
                    <p className="font-semibold">{t.ahead(data.similar.aheadOf)}</p>
                    <p className="text-sm text-[var(--muted)]">{t.approvedShare(data.similar.approvedShare)}</p>
                  </div>
                </details>
                <p className="text-center font-medium text-[var(--accent)]">{t.similarCount(data.similar.cases)}</p>
              </>
            ) : (
              <NotEnough text={notEnough} />
            )}
          </section>

          <div className="mt-2 flex flex-col gap-1 border-t border-[var(--border)] pt-5">
            <h2 className="text-2xl font-bold tracking-tight">{t.stats(form)}</h2>
            {data.dataAsOf && <p className="text-[var(--muted)]">{t.updated(formatDay(data.dataAsOf, es))}</p>}
          </div>
        </>
      )}

      <Card id="ins-updates" icon={ICONS.calendar} title={t.updates[win]}>
        <nav aria-label={t.updates[win]} className="flex gap-1 self-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {(["day", "month", "year"] as const).map((w) => (
            <Link
              key={w}
              href={href({ window: w }, "ins-updates")}
              scroll={false}
              aria-current={w === win ? "page" : undefined}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${w === win ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
            >
              {t.windows[w]}
            </Link>
          ))}
        </nav>
        {activity.cases !== null && slices.length ? (
          <>
            <Donut slices={slices} picked={picked} center={center} />
            <p className="text-center font-semibold">{t.total(activity.cases)}</p>
            <p className="text-center text-xs text-[var(--muted)]">{t.pick}</p>
            {(() => {
              const row = (s: (typeof slices)[number]) => (
                <li key={s.key}>
                  <Link
                    href={href({ window: win, kind: s.key }, "ins-updates")}
                    scroll={false}
                    aria-current={s.key === picked ? "true" : undefined}
                    className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-[var(--surface-2)]"
                  >
                    <span aria-hidden="true" className={`h-3 w-3 rounded-full ${s.key === picked ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`} />
                    <span className={s.key === picked ? "font-semibold" : ""}>{s.label}</span>
                    <span className="text-sm text-[var(--muted)]">{s.share.toLocaleString(t.locale)}%</span>
                    <span className="ml-auto font-semibold tabular-nums">{n(s.value)}</span>
                  </Link>
                </li>
              );
              return (
                <>
                  <ul className="flex flex-col">{slices.slice(0, 4).map(row)}</ul>
                  {slices.length > 4 && (
                    <details>
                      <summary className="cursor-pointer list-none rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-center font-medium">{t.seeMore} ▾</summary>
                      <ul className="mt-1 flex flex-col">{slices.slice(4).map(row)}</ul>
                    </details>
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-receipt" icon={ICONS.receipt} title={t.receipt} help={t.receiptHelp}>
        {offices.length ? (
          <>
            <ul className="flex flex-col gap-2.5">
              {offices.map((o) => (
                <li key={o.code} className="flex items-center gap-3" title={`${o.name ? o.name[lang] : o.code}: ${t.days(o.medianDays)}${o.yours ? ` · ${t.yourOffice}` : ""}`}>
                  <span className={`w-11 flex-none ${o.yours ? "font-extrabold" : "font-semibold"}`}>{o.code}</span>
                  <span className="flex-1">
                    <span className={`block h-3.5 rounded-r ${o.yours ? "bg-[var(--chart-accent)]" : "bg-[var(--chart-muted)]"}`} style={{ width: `${Math.max(4, (o.medianDays / officeMax) * 100)}%` }} />
                  </span>
                  <span className="w-20 flex-none text-right font-semibold">{t.days(o.medianDays)}</span>
                </li>
              ))}
            </ul>
            {data.offices?.overallMedianDays != null && <p className="text-sm text-[var(--muted)]">{t.allOffices(data.offices.overallMedianDays, data.offices.cases)}</p>}
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-processing" icon={ICONS.clock} title={t.processing} sub={offices.length ? t.processingPick : undefined}>
        {office ? (
          <>
            <div className="flex flex-wrap gap-2">
              {offices.map((o) => (
                <Link
                  key={o.code}
                  href={href({ office: o.code }, "ins-processing")}
                  scroll={false}
                  aria-current={o.code === office.code ? "true" : undefined}
                  className={`rounded-full border px-3 py-1 text-sm ${o.code === office.code ? "border-[var(--accent)] bg-[var(--accent-soft)] font-extrabold text-[var(--accent)]" : "border-[var(--border)] font-semibold"}`}
                >
                  {o.code}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] p-4">
              <span className="text-sm text-[var(--muted)]">{office.name ? office.name[lang] : office.code}</span>
              <span className="text-3xl font-extrabold tracking-tight">{t.days(office.medianDays)}</span>
              <span>{t.aboutMonths(Math.max(1, Math.round(office.medianDays / 30.4)))}</span>
              <span className="text-xs text-[var(--muted)]">{t.processingBasis(office.cases)}</span>
            </div>
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
        <p className="text-sm">{t.officialText(form, officeName)}</p>
        <a href={data.processingTimesUrl} target="_blank" rel="noopener noreferrer" className="self-start rounded-xl border border-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent)]">
          {t.official} ↗
        </a>
      </Card>

      <Card id="ins-next" icon={ICONS.list} title={t.next} sub={t.nextSub}>
        {next && top ? (
          <>
            <p className="rounded-xl bg-[var(--surface-2)] px-4 py-3.5 font-medium">{top.title[lang]}</p>
            <div className="flex">
              <div className="flex flex-1 flex-col gap-0.5 pr-4">
                <span className="text-sm text-[var(--muted)]">{t.probability}</span>
                <span className="text-3xl font-extrabold">{top.share}%</span>
              </div>
              <div className="w-px bg-[var(--border)]" />
              <div className="flex flex-1 flex-col gap-0.5 pl-5">
                <span className="text-sm text-[var(--muted)]">{t.avgTime}</span>
                <span className="text-3xl font-extrabold">{top.avgDays != null ? t.days(top.avgDays) : "—"}</span>
              </div>
            </div>
            {next.options.length > 1 && (
              <details>
                <summary className="cursor-pointer text-sm text-[var(--muted)] underline underline-offset-2">{t.nextOthers}</summary>
                <ul className="mt-2 flex flex-col">
                  {next.options.slice(1).map((o) => (
                    <li key={o.title.en} className="flex items-center gap-3 border-t border-[var(--border)] py-2">
                      <span className="flex-1">{o.title[lang]}</span>
                      <span className="font-semibold">{o.share}%</span>
                      <span className="w-20 text-right text-sm text-[var(--muted)]">{o.avgDays != null ? t.days(o.avgDays) : "—"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-xs text-[var(--muted)]">{t.nextBasis(next.cases)}</p>
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

      <Card id="ins-rates" icon={ICONS.check} title={t.rates}>
        {data.rates && form ? (
          <>
            <p className="text-sm text-[var(--muted)]">
              {data.rates.approval
                ? t.ratesText(form, data.rates.approval.decided, data.rates.approval.rate, data.rates.rfe?.rate ?? null)
                : data.rates.rfe
                  ? t.rfeOnly(data.rates.rfe.rate, data.rates.rfe.cases)
                  : ""}
            </p>
            <div className="flex gap-4">
              {data.rates.approval && <Ring value={data.rates.approval.rate} label={t.approval} tone="done" />}
              {data.rates.rfe && <Ring value={data.rates.rfe.rate} label={t.rfe} tone="action" />}
            </div>
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <Card id="ins-trend" icon={ICONS.trend} title={t.trend} help={t.trendHelp}>
        {data.trend ? (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                ["var(--trend-approved)", t.approved],
                ["var(--trend-evidence)", t.rfe],
                ["var(--trend-denied)", t.denied],
              ].map(([color, label]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex h-36 items-end gap-1 border-b border-[var(--border)]" role="img" aria-label={data.trend.months.map((m) => `${monthName(m.month, t, "long", true)}: ${m.approved} ${t.approved}, ${m.evidence} ${t.rfe}, ${m.denied} ${t.denied}`).join("; ")}>
              {data.trend.months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end" title={`${monthName(m.month, t, "long", true)}: ${m.approved} ${t.approved} · ${m.evidence} ${t.rfe} · ${m.denied} ${t.denied}`}>
                  <div className="flex w-[72%] max-w-6 flex-col gap-0.5">
                    {[
                      [m.denied, "var(--trend-denied)"],
                      [m.evidence, "var(--trend-evidence)"],
                      [m.approved, "var(--trend-approved)"],
                    ]
                      .filter(([v]) => (v as number) > 0)
                      .map(([v, color], i) => (
                        <div key={String(color)} className={i === 0 ? "rounded-t" : ""} style={{ height: `${Math.max(2, ((v as number) / trendMax) * 128)}px`, background: color as string }} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {data.trend.months.map((m) => (
                <span key={m.month} className="flex-1 truncate text-center text-[11px] text-[var(--muted)]">
                  {monthName(m.month, t)}
                </span>
              ))}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--muted)] underline underline-offset-2">{t.table}</summary>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="py-1 font-medium">{t.month}</th>
                    <th className="py-1 text-right font-medium">{t.approved}</th>
                    <th className="py-1 text-right font-medium">{t.rfe}</th>
                    <th className="py-1 text-right font-medium">{t.denied}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trend.months.map((m) => (
                    <tr key={m.month} className="border-t border-[var(--border)]">
                      <td className="py-1">{monthName(m.month, t, "long", true)}</td>
                      <td className="py-1 text-right tabular-nums">{m.approved}</td>
                      <td className="py-1 text-right tabular-nums">{m.evidence}</td>
                      <td className="py-1 text-right tabular-nums">{m.denied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <NotEnough text={notEnough} />
        )}
      </Card>

      <p className="text-xs text-[var(--muted)]">{t.note}</p>
    </div>
  );
}

/** The link from a case page to its analysis. */
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
            {es ? "Aprobaciones del mes, casos parecidos, próximos mensajes y tiempos por oficina." : "Monthly approvals, similar cases, next messages and times by office, from CasePingo cases like it."}
          </span>
        </span>
      </span>
      <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
