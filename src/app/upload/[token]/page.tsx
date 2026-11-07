import type { Metadata } from "next";
import Link from "next/link";
import { FirmBrand } from "@/components/firm-brand";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { documentRequestService } from "@/lib/firms";
import { ACCEPT } from "@/lib/firms/documents";
import { REQUEST_ITEM_STATUS } from "@/lib/firms/requests";
import { SITE } from "@/lib/site";
import { UploadItem } from "./upload-item";

/** A law firm's client uploads requested documents here, from a private link. Never indexed. */
export const metadata: Metadata = { title: "Upload documents", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const T = {
  en: {
    heading: (n: string) => `Hello ${n}`,
    asks: (f: string) => `${f} needs these documents from you. Upload each one from your phone or computer: no account needed.`,
    due: "Please upload by",
    progress: (a: number, b: number) => `${a} of ${b} accepted`,
    choose: "Choose a file or take a photo",
    send: "Send",
    sending: "Sending…",
    hint: "A clear photo of every page, or a PDF. Up to 4 MB.",
    another: "Add another file",
    optional: "if it applies",
    done: "Thank you! Your law firm has everything it asked for.",
    private: "This page is private. Please don't share the link.",
    questions: (f: string) => `Questions? Contact ${f}.`,
    email: "Email",
    switchTo: "Ver en español",
    powered: "Secure uploads by",
  },
  es: {
    heading: (n: string) => `Hola, ${n}`,
    asks: (f: string) => `${f} necesita estos documentos. Suba cada uno desde su teléfono o computadora: no necesita cuenta.`,
    due: "Fecha límite",
    progress: (a: number, b: number) => `${a} de ${b} aceptados`,
    choose: "Elija un archivo o tome una foto",
    send: "Enviar",
    sending: "Enviando…",
    hint: "Una foto clara de cada página, o un PDF. Hasta 4 MB.",
    another: "Agregar otro archivo",
    optional: "si corresponde",
    done: "¡Gracias! Su abogado ya tiene todo lo que pidió.",
    private: "Esta página es privada. No comparta el enlace.",
    questions: (f: string) => `¿Preguntas? Comuníquese con ${f}.`,
    email: "Correo",
    switchTo: "View in English",
    powered: "Carga segura por",
  },
} as const;

const BADGE: Record<string, string> = {
  PENDING: "bg-[var(--surface-2)] text-[var(--muted)]",
  UPLOADED: "bg-[var(--st-progress-bg)] text-[var(--st-progress)]",
  ACCEPTED: "bg-[var(--st-done-bg)] text-[var(--st-done)]",
  REJECTED: "bg-[var(--st-stop-bg)] text-[var(--st-stop)]",
};

export default function UploadPage(props: PageProps<"/upload/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-2xl px-4 py-16 text-[var(--muted)]">Loading…</div>}>
      <UploadView {...props} />
    </Suspense>
  );
}

async function UploadView({ params, searchParams }: PageProps<"/upload/[token]">) {
  const { token } = await params;
  const { lang: requested } = await searchParams;
  const v = await documentRequestService().publicView(token);
  if (!v) notFound();
  const lang = requested === "es" || requested === "en" ? requested : v.client.locale;
  const es = lang === "es";
  const t = T[lang];
  const firm = v.firm.name;
  const due = v.dueOn ? new Intl.DateTimeFormat(es ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(v.dueOn) : null;

  return (
    <div lang={lang} className="flex flex-1 flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <FirmBrand name={firm} logo={v.firm.logo} />
          <Link href={`/upload/${token}?lang=${es ? "en" : "es"}`} hrefLang={es ? "en" : "es"} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]">
            {t.switchTo}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight">{t.heading(v.client.name)}</h1>
          <p className="text-[var(--muted)]">{t.asks(firm)}</p>
          <p className="text-sm font-semibold">{v.title}</p>
          {v.message && <p className="whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{v.message}</p>}
          <p className="flex flex-wrap gap-x-4 text-sm text-[var(--muted)]">
            {due && (
              <span>
                {t.due}: <strong className="text-[var(--foreground)]">{due}</strong>
              </span>
            )}
            <span>{t.progress(v.progress.requiredAccepted, v.progress.required)}</span>
          </p>
        </div>
        {v.status === "COMPLETED" && (
          <p role="status" className="rounded-lg border border-[var(--success)] bg-[var(--surface)] p-4 font-medium text-[var(--success)]">
            {t.done}
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {v.items.map((it) => {
            const label = es && it.labelEs ? it.labelEs : it.label;
            const canUpload = v.status === "OPEN" && it.status !== "ACCEPTED";
            return (
              <li key={it.id} className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 font-semibold">
                    {label}
                    {!it.required && <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">({t.optional})</span>}
                  </h2>
                  <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${BADGE[it.status]}`}>{REQUEST_ITEM_STATUS[it.status][lang]}</span>
                </div>
                {it.note && !es && <p className="text-sm text-[var(--muted)]">{it.note}</p>}
                {it.status === "REJECTED" && it.rejectReason && <p className="rounded-md bg-[var(--st-stop-bg)] px-3 py-2 text-sm text-[var(--st-stop)]">{it.rejectReason}</p>}
                {it.files.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm text-[var(--muted)]">
                    {it.files.map((f, i) => (
                      <li key={i} className="truncate">
                        ✓ {f.name}
                      </li>
                    ))}
                  </ul>
                )}
                {canUpload && <UploadItem token={token} itemId={it.id} lang={lang} accept={ACCEPT} t={{ choose: it.files.length ? t.another : t.choose, send: t.send, sending: t.sending, hint: t.hint }} />}
              </li>
            );
          })}
        </ol>
        <section className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <p className="font-semibold">{t.questions(firm)}</p>
          {v.firm.clientContactLine && <p>{v.firm.clientContactLine}</p>}
          {v.firm.replyToEmail && (
            <p>
              {t.email}:{" "}
              <a href={`mailto:${v.firm.replyToEmail}`} className="font-medium text-[var(--accent)] underline underline-offset-2">
                {v.firm.replyToEmail}
              </a>
            </p>
          )}
        </section>
        <p className="text-xs text-[var(--muted)]">{t.private}</p>
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
