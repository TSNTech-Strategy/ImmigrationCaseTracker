import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { caseService } from "@/lib/cases";
import { formInfo, observedApprovalAt } from "@/lib/case-insights";
import { caseJourney } from "@/lib/journeys";
import { journeyShare } from "@/lib/my-cases";
import { approvedSealSvg } from "@/lib/journey-seal";
import { formatDay } from "@/components/line-map";
import { JourneyShareActions } from "@/components/journey-share-actions";

export const metadata: Metadata = { title: "Journey approved · CasePingo" };

const T = {
  en: { back: "← Back to the case", congrats: "Congratulations!", has: "YOUR CASE HAS BEEN", approved: "APPROVED!", sub: "Every step of your journey led to this moment. You did it!", form: "Form", on: "Approved on", length: "Journey", days: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`, journey: "YOUR JOURNEY", noDate: "Date not shown", paid: "YOUR HARD WORK PAID OFF", paidText: "This is more than a milestone. It's the start of your next chapter.", stamp: "APPROVED", shareYour: "Share your success!", foot: "Track your immigration journey with CasePingo", note: "The picture and the message never include your receipt number.", labels: { share: "Share my journey", download: "Download the picture", copy: "Copy the message", copied: "Copied. Paste it wherever you like.", downloaded: "Picture downloaded.", failed: "Couldn't share right now. Try Download the picture." }, title: "My immigration journey" },
  es: { back: "← Volver al caso", congrats: "¡Felicidades!", has: "SU CASO HA SIDO", approved: "¡APROBADO!", sub: "Cada paso de su trayectoria lo trajo hasta aquí. ¡Lo logró!", form: "Formulario", on: "Aprobado el", length: "Duración", days: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"}`, journey: "SU TRAYECTORIA", noDate: "Sin fecha", paid: "SU ESFUERZO DIO FRUTOS", paidText: "Es más que un logro: es el comienzo de una nueva etapa.", stamp: "APROBADO", shareYour: "¡Comparta su logro!", foot: "Siga su trámite de inmigración con CasePingo", note: "La imagen y el mensaje nunca incluyen su número de recibo.", labels: { share: "Compartir mi trayectoria", download: "Descargar la imagen", copy: "Copiar el mensaje", copied: "Copiado. Péguelo donde quiera.", downloaded: "Imagen descargada.", failed: "No se pudo compartir ahora. Pruebe Descargar la imagen." }, title: "Mi trayectoria de inmigración" },
};

/** Journey approved: the celebration for an approved case, with the picture to share. */
export default async function JourneyApprovedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/cases/${id}/approved`);
  const c = await caseService().getCase(user.id, id);
  if (!c) notFound(); // also for other people's cases
  const journey = caseJourney(c);
  const share = journeyShare(c, journey, observedApprovalAt(c.statusTitleEn, c.events));
  if (!share) redirect(`/cases/${id}`);
  const es = user.locale === "es";
  const lang = es ? "es" : "en";
  const t = T[lang];
  const code = formInfo(c.formType)?.code ?? null;
  const scenario = journey.lineMap.scenario === "general" ? null : journey.lineMap.name[lang];
  const seal = `data:image/svg+xml;base64,${Buffer.from(approvedSealSvg()).toString("base64")}`;
  const stat = (label: string, value: string) => (
    <div className="flex flex-1 flex-col items-center gap-0.5 px-2 text-center">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#5b6b82]">{label}</span>
      <span className="text-base font-extrabold text-[#0f1b2d] sm:text-lg">{value}</span>
    </div>
  );

  return (
    <>
      <Link href={`/cases/${id}`} className="text-sm underline underline-offset-2">
        {t.back}
      </Link>
      <article aria-labelledby="approved-h" className="mx-auto w-full max-w-xl overflow-hidden rounded-[28px] border-[3px] border-[#f2c14e] bg-white text-[#0f1b2d] shadow-[var(--shadow)]">
        <div aria-hidden="true" className="flex h-2">
          <span className="flex-1 bg-[#e43b53]" />
          <span className="flex-1 bg-[#1758a8]" />
        </div>
        <div className="flex flex-col items-center gap-1 px-6 pt-8 text-center">
          <p className="text-3xl font-extrabold tracking-tight text-[#b8233a]">{t.congrats}</p>
          <p className="text-xs font-extrabold tracking-[0.25em]">{t.has}</p>
          <h1 id="approved-h" className="text-5xl font-black tracking-tight">
            {t.approved}
          </h1>
          <p className="max-w-md text-balance text-[#33445c]">{t.sub}</p>
          <span className="mt-2 rounded-full border border-[#f2c14e] bg-[#fff8e6] px-3 py-0.5 font-mono text-xs font-bold tracking-wider">{c.receiptMasked}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG seal, not a photo */}
          <img src={seal} alt="" width={220} height={202} className="mt-4" />
          {scenario && <span className="-mt-1 rounded-full bg-[#e6effb] px-4 py-1 font-extrabold text-[#1758a8]">{scenario}</span>}
        </div>
        <div className="mx-4 mt-6 flex rounded-2xl border-2 border-[#dce3ee] py-3 sm:mx-6">
          {stat(t.form, code ?? "—")}
          <span aria-hidden="true" className="w-0.5 bg-[#dce3ee]" />
          {stat(t.on, share.approvedOn ? formatDay(share.approvedOn, es) : "—")}
          <span aria-hidden="true" className="w-0.5 bg-[#dce3ee]" />
          {stat(t.length, share.days !== null ? t.days(share.days) : "—")}
        </div>
        <h2 className="mt-6 text-center text-sm font-extrabold tracking-[0.25em]">{t.journey}</h2>
        <ol className="mt-4 grid grid-cols-3 gap-y-4 px-3">
          {share.steps.map((s, i) => {
            const last = i === share.steps.length - 1;
            return (
              <li key={s.key} className="flex flex-col items-center gap-1 text-center">
                <span aria-hidden="true" className={`relative flex h-11 w-11 items-center justify-center rounded-full ${last ? "border-2 border-[#f2c14e] bg-[#fff8e6] text-[#9a6b00]" : "bg-[#0f1b2d] text-white"}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className={`text-sm font-extrabold ${last ? "text-[#9a6b00]" : ""}`}>{s.label[lang]}</span>
                <span className="text-xs text-[#5b6b82]">{s.date ? formatDay(s.date, es) : t.noDate}</span>
              </li>
            );
          })}
        </ol>
        <div className="mx-4 mt-6 flex items-center gap-3 rounded-2xl border-2 border-[#dce3ee] p-4 sm:mx-6">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f1b2d] text-white">
            ♥
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-extrabold tracking-wide">{t.paid}</span>
            <span className="text-sm text-[#33445c]">{t.paidText}</span>
          </span>
          <span aria-hidden="true" className="-rotate-12 rounded-md border-2 border-[#9aa6b8] px-1.5 text-xs font-black tracking-wider text-[#9aa6b8]">
            {t.stamp}
          </span>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 bg-[#0f1b2d] px-6 py-6 text-center">
          <p className="text-xl font-extrabold text-[#f2c14e]">{t.shareYour}</p>
          <JourneyShareActions imageUrl={`/cases/${id}/journey-card?lang=${lang}`} text={share.text[lang]} title={t.title} labels={t.labels} />
          <p className="text-sm font-semibold text-white">{t.foot}</p>
        </div>
      </article>
      <p className="text-center text-xs text-[var(--muted)]">{t.note}</p>
    </>
  );
}
