import type { Metadata } from "next";
import Link from "next/link";
import { FirmBrand } from "@/components/firm-brand";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { firmUpdateService } from "@/lib/firms";
import { LineMapSection } from "@/components/line-map";
import { StatusBadge } from "@/components/status-badge";
import { SITE } from "@/lib/site";

/**
 * A law firm's client opens this from a link the firm sent: where each of their cases stands,
 * in English or Spanish. No sign-in; the signed link is the key, and the firm can replace or
 * turn it off. Never indexed, never shows full receipt numbers or USCIS's case text.
 */
export const metadata: Metadata = {
  title: "Case status",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const T = {
  en: {
    heading: (name: string) => `${name}'s case status`,
    from: (firm: string) => `Shared with you by ${firm}`,
    receipt: "Receipt",
    meaning: "What it means",
    next: "What usually happens next",
    nextStep: "Next step",
    days: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"} since filing`,
    since: (n: number) => (n === 0 ? "Updated today" : `Last change ${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"} ago`),
    checked: "USCIS last checked",
    never: "Not checked yet",
    none: "There are no cases on this page yet.",
    noStatus: "Waiting for the first status from USCIS",
    questions: (firm: string) => `Questions? Contact ${firm}.`,
    email: "Email",
    disclaimer: (firm: string) =>
      `This page shows the status USCIS publishes for each case, with plain-language help. It isn't legal advice, and USCIS can be behind or change a status. ${firm} is your contact for anything about your case. ${SITE.name} is not affiliated with USCIS or DHS.`,
    powered: "Case tracking by",
    switchTo: "Ver en español",
    needH: "Documents we need from you",
    needIntro: (firm: string) => `${firm} asked you to upload these. It takes a few minutes from your phone.`,
    dueBy: (d: string) => `Please upload by ${d}`,
    progress: (done: number, total: number) => `${done} of ${total} accepted`,
    toUpload: (n: number) => (n === 1 ? "1 document to upload" : `${n} documents to upload`),
    inReview: "Your firm is reviewing what you sent",
    upload: "Upload documents",
    docsH: "Your documents",
    docsIntro: (firm: string) => `Files ${firm} shared with you, and what you uploaded.`,
    fromFirm: (firm: string) => `From ${firm}`,
    fromYou: "Uploaded by you",
    open: "Open",
    download: "Download",
  },
  es: {
    heading: (name: string) => `Estado del caso de ${name}`,
    from: (firm: string) => `Compartido con usted por ${firm}`,
    receipt: "Recibo",
    meaning: "Qué significa",
    next: "Qué suele pasar después",
    nextStep: "Próximo paso",
    days: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"} desde la solicitud`,
    since: (n: number) => (n === 0 ? "Actualizado hoy" : `Último cambio hace ${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"}`),
    checked: "Última consulta a USCIS",
    never: "Aún no consultado",
    none: "Todavía no hay casos en esta página.",
    noStatus: "Esperando el primer estado de USCIS",
    questions: (firm: string) => `¿Preguntas? Comuníquese con ${firm}.`,
    email: "Correo",
    disclaimer: (firm: string) =>
      `Esta página muestra el estado que USCIS publica para cada caso, con una explicación sencilla. No es asesoría legal, y USCIS puede tardar en actualizar o cambiar un estado. ${firm} es su contacto para todo lo relacionado con su caso. ${SITE.name} no está afiliado con USCIS ni con DHS.`,
    powered: "Seguimiento de casos por",
    switchTo: "View in English",
    needH: "Documentos que necesitamos de usted",
    needIntro: (firm: string) => `${firm} le pidió que suba estos documentos. Toma unos minutos desde su teléfono.`,
    dueBy: (d: string) => `Súbalos antes del ${d}`,
    progress: (done: number, total: number) => `${done} de ${total} aceptados`,
    toUpload: (n: number) => (n === 1 ? "1 documento por subir" : `${n} documentos por subir`),
    inReview: "Su bufete está revisando lo que envió",
    upload: "Subir documentos",
    docsH: "Sus documentos",
    docsIntro: (firm: string) => `Archivos que ${firm} compartió con usted, y lo que usted subió.`,
    fromFirm: (firm: string) => `De ${firm}`,
    fromYou: "Subido por usted",
    open: "Abrir",
    download: "Descargar",
  },
} as const;

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const viewable = (name: string) => /\.(pdf|png|jpe?g|webp)$/i.test(name);
const fmtDue = (d: Date, lang: "en" | "es") => new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
const fmt = (d: Date, lang: "en" | "es") => new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(d);

export default function ClientStatusPage(props: PageProps<"/status/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-2xl px-4 py-16 text-[var(--muted)]">Loading…</div>}>
      <StatusView {...props} />
    </Suspense>
  );
}

async function StatusView({ params, searchParams }: PageProps<"/status/[token]">) {
  const { token } = await params;
  const { lang: requested } = await searchParams;
  const view = await firmUpdateService().portalView(token);
  if (!view) notFound();
  const lang = requested === "es" || requested === "en" ? requested : view.client.locale;
  const es = lang === "es";
  const t = T[lang];
  const firm = view.firm.name;

  return (
    <div lang={lang} className="flex flex-1 flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <FirmBrand name={firm} logo={view.firm.logo} />
          <Link href={`/status/${token}?lang=${es ? "en" : "es"}`} hrefLang={es ? "en" : "es"} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]">
            {t.switchTo}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight">{t.heading(view.client.displayName)}</h1>
          <p className="text-sm text-[var(--muted)]">{t.from(firm)}</p>
        </div>
        {view.requests.length > 0 && (
          <section aria-labelledby="need-h" className="flex flex-col gap-3 rounded-lg border-2 border-[var(--accent)] bg-[var(--surface)] p-5">
            <div className="flex flex-col gap-1">
              <h2 id="need-h" className="text-lg font-semibold">
                {t.needH}
              </h2>
              <p className="text-sm text-[var(--muted)]">{t.needIntro(firm)}</p>
            </div>
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {view.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {r.waiting > 0 ? t.toUpload(r.waiting) : t.inReview}
                      {r.required > 0 && ` · ${t.progress(r.done, r.required)}`}
                    </p>
                    {r.dueOn && <p className="text-sm font-medium">{t.dueBy(fmtDue(r.dueOn, lang))}</p>}
                  </div>
                  <Link href={`${r.uploadPath}?lang=${lang}`} className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
                    {t.upload}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {view.cases.length === 0 && <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">{t.none}</p>}
        {view.cases.map((c, i) => {
          const title = (es ? (c.statusTitleEs ?? c.statusTitleEn) : c.statusTitleEn) ?? t.noStatus;
          return (
            <article key={c.id} aria-labelledby={`case-${i}-h`} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`case-${i}-h`} className="text-lg font-semibold">
                    {c.form ? `${c.form.code}${c.form.name ? ` · ${c.form.name[lang]}` : ""}` : t.receipt}
                  </h2>
                  <span className="font-mono text-sm text-[var(--muted)]">
                    {t.receipt} {c.receiptMasked}
                  </span>
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  <StatusBadge titleEn={c.statusTitleEn} es={es} />
                  <p className="text-xl font-semibold">{title}</p>
                </div>
                <p className="rounded-md bg-[var(--surface-2)] px-3 py-2">
                  <span aria-hidden="true" className="text-[var(--accent)]">
                    →{" "}
                  </span>
                  <strong className="font-semibold">{t.nextStep}:</strong> {c.nextStep[lang]}
                </p>
                {c.guide && (
                  <dl className="flex flex-col gap-3 text-[0.95rem] leading-relaxed">
                    <div>
                      <dt className="font-semibold">{t.meaning}</dt>
                      <dd>{c.guide[lang].meaning}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">{t.next}</dt>
                      <dd>{c.guide[lang].next}</dd>
                    </div>
                  </dl>
                )}
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                  {c.days.total !== null && <span>{t.days(c.days.total)}</span>}
                  {c.days.sinceUpdate !== null && <span>{t.since(c.days.sinceUpdate)}</span>}
                  <span>
                    {t.checked}: {c.lastCheckedAt ? fmt(c.lastCheckedAt, lang) : t.never}
                  </span>
                </p>
              </div>
              <LineMapSection map={c.lineMap} es={es} idPrefix={`linemap-${i}`} />
            </article>
          );
        })}
        {view.documents.length > 0 && (
          <section aria-labelledby="docs-h" className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-col gap-1">
              <h2 id="docs-h" className="text-lg font-semibold">
                {t.docsH}
              </h2>
              <p className="text-sm text-[var(--muted)]">{t.docsIntro(firm)}</p>
            </div>
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {view.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {d.source === "CLIENT" ? t.fromYou : t.fromFirm(firm)} · {fmt(d.createdAt, lang)} · {size(d.size)}
                    </p>
                  </div>
                  <span className="flex gap-3 text-sm font-medium">
                    {viewable(d.name) && (
                      <a href={`/status/${token}/files/${d.id}?view=1`} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                        {t.open}
                      </a>
                    )}
                    <a href={`/status/${token}/files/${d.id}`} className="text-[var(--accent)] hover:underline">
                      {t.download}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-label={t.questions(firm)} className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-semibold">{t.questions(firm)}</p>
          {view.firm.clientContactLine && <p>{view.firm.clientContactLine}</p>}
          {view.firm.replyToEmail && (
            <p>
              {t.email}:{" "}
              <a href={`mailto:${view.firm.replyToEmail}`} className="font-medium text-[var(--accent)] underline underline-offset-2">
                {view.firm.replyToEmail}
              </a>
            </p>
          )}
        </section>
        <p className="text-xs leading-relaxed text-[var(--muted)]">{t.disclaimer(firm)}</p>
      </main>
      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        {t.powered}{" "}
        <Link href="/" className="font-semibold text-[var(--foreground)] hover:underline">
          {SITE.name}
        </Link>
      </footer>
    </div>
  );
}
