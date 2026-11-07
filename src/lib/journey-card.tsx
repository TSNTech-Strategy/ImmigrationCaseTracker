/* eslint-disable @next/next/no-img-element -- ImageResponse (Satori) draws plain <img> tags; next/image doesn't apply. */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { caseService } from "@/lib/cases";
import { formInfo, observedApprovalAt } from "@/lib/case-insights";
import { caseJourney } from "@/lib/journeys";
import { journeyShare, type JourneyShare, type Lang } from "@/lib/my-cases";
import { SITE } from "@/lib/site";
import { approvedSealSvg } from "@/lib/journey-seal";

/**
 * "Share my journey" as a picture: the approved case's form, approval day,
 * days it took and dated steps, in CasePingo's look (1080 × 1350, the 4:5
 * shape social apps show in full). Never the receipt number or the nickname.
 * The app and the website share the same picture.
 */

const W = 1080;
const H = 1350;
const C = { navy: "#0F1B2D", blue: "#1758A8", red: "#E43B53", redText: "#B8233A", muted: "#5B6B82", line: "#DCE3EE", soft: "#EEF3FA", page: "#F4F6FA", green: "#1E7A43" };

const TEXT = {
  en: { congrats: "Congratulations!", has: "YOUR CASE HAS BEEN", approved: "APPROVED!", sub: "Every step of your journey led to this moment.", form: "FORM", on: "APPROVED ON", length: "JOURNEY", days: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`, journey: "YOUR JOURNEY", noDate: "Date not shown", foot: "Track your immigration journey with" },
  es: { congrats: "¡Felicidades!", has: "SU CASO HA SIDO", approved: "¡APROBADO!", sub: "Cada paso de su trayectoria lo trajo hasta aquí.", form: "FORMULARIO", on: "APROBADO EL", length: "DURACIÓN", days: (n: number) => `${n.toLocaleString("es-US")} ${n === 1 ? "día" : "días"}`, journey: "SU TRAYECTORIA", noDate: "Sin fecha", foot: "Siga su trámite de inmigración con" },
} satisfies Record<Lang, unknown>;

const short = (day: string, lang: Lang) => new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 500 | 700 | 800 }[]; mark: string | null }> | null = null;
function loadAssets() {
  assets ??= (async () => {
    const dir = join(process.cwd(), "src/assets");
    const font = async (weight: 500 | 700 | 800) => ({ name: "Jakarta", data: await readFile(join(dir, `fonts/PlusJakartaSans-${weight}.woff`)), weight });
    try {
      const [f5, f7, f8, mark] = await Promise.all([font(500), font(700), font(800), readFile(join(dir, "casepingo-mark.png"))]);
      return { fonts: [f5, f7, f8], mark: `data:image/png;base64,${mark.toString("base64")}` };
    } catch (err) {
      // Files missing from the server bundle: still draw the picture, in the default font and without the logo.
      console.error("journey-card: assets unavailable, using the default font", err);
      return { fonts: [], mark: null };
    }
  })();
  return assets;
}

export type JourneyCardInput = { share: JourneyShare; formCode: string | null; scenario: { en: string; es: string } | null; lang: Lang };

export async function renderJourneyCard({ share, formCode, scenario, lang }: JourneyCardInput): Promise<ImageResponse> {
  const t = TEXT[lang];
  const { fonts, mark } = await loadAssets();
  const seal = `data:image/svg+xml;base64,${Buffer.from(approvedSealSvg()).toString("base64")}`;
  const steps = share.steps.slice(-6);
  const stat = (label: string, value: string) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: C.navy }}>{value}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", padding: 40, background: C.page, ...(fonts.length ? { fontFamily: "Jakarta" } : {}) }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "#FFFFFF", borderRadius: 48, border: `6px solid ${C.blue}`, overflow: "hidden" }}>
          <div style={{ display: "flex", width: "100%", height: 14 }}>
            <div style={{ flex: 1, background: C.red }} />
            <div style={{ flex: 1, background: C.blue }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30 }}>
            {mark && <img src={mark} alt="" width={64} height={64} style={{ borderRadius: 16 }} />}
            <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: C.navy }}>
              Case<span style={{ color: C.red }}>Pingo</span>
            </div>
          </div>
          <div style={{ marginTop: 22, fontSize: 62, fontWeight: 800, color: C.redText }}>{t.congrats}</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 700, letterSpacing: 6, color: C.navy }}>{t.has}</div>
          <div style={{ fontSize: 112, fontWeight: 800, color: C.navy, lineHeight: 1.05, letterSpacing: -2 }}>{t.approved}</div>
          <div style={{ marginTop: 8, fontSize: 29, fontWeight: 500, color: C.muted }}>{t.sub}</div>
          <img src={seal} alt="" width={264} height={242} style={{ marginTop: 18 }} />
          {scenario && (
            <div style={{ display: "flex", marginTop: -6, padding: "8px 26px", borderRadius: 999, background: C.soft, fontSize: 28, fontWeight: 800, color: C.blue }}>
              {scenario[lang]}
            </div>
          )}
          <div style={{ display: "flex", width: 920, marginTop: 24, padding: "20px 12px", borderRadius: 28, border: `3px solid ${C.line}` }}>
            {stat(t.form, formCode ?? "—")}
            <div style={{ width: 3, background: C.line }} />
            {stat(t.on, share.approvedOn ? short(share.approvedOn, lang) : "—")}
            <div style={{ width: 3, background: C.line }} />
            {stat(t.length, share.days !== null ? t.days(share.days) : "—")}
          </div>
          <div style={{ marginTop: 24, fontSize: 26, fontWeight: 800, letterSpacing: 5, color: C.navy }}>{t.journey}</div>
          <div style={{ display: "flex", width: 960, marginTop: 16, marginBottom: 28, justifyContent: "center" }}>
            {steps.map((s, i) => (
              <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 960 / steps.length, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ flex: 1, height: 5, background: i === 0 ? "transparent" : C.green }} />
                  <div style={{ width: 52, height: 52, borderRadius: 26, background: i === steps.length - 1 ? C.green : C.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24">
                      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, height: 5, background: i === steps.length - 1 ? "transparent" : C.green }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 58, fontSize: 22, fontWeight: 800, color: C.navy, textAlign: "center", padding: "0 6px", lineHeight: 1.2 }}>{s.label[lang]}</div>
                <div style={{ fontSize: 19, fontWeight: 500, color: C.muted }}>{s.date ? short(s.date, lang) : t.noDate}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: "26px 0", background: C.navy, color: "#FFFFFF", fontSize: 26, fontWeight: 700 }}>
            <span>{t.foot}</span>
            <span style={{ color: "#FF8B98", marginLeft: 10 }}>{SITE.name}</span>
            <span style={{ marginLeft: 10 }}>· {SITE.domain}</span>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length ? { fonts } : {}), headers: { "Cache-Control": "private, no-store" } },
  );
}

/** The picture for one of this person's cases, or null when it isn't theirs or isn't approved. */
export async function journeyCardFor(userId: string, caseId: string, lang: Lang): Promise<ImageResponse | null> {
  const c = await caseService().getCase(userId, caseId);
  if (!c) return null;
  const journey = caseJourney(c);
  const share = journeyShare(c, journey, observedApprovalAt(c.statusTitleEn, c.events));
  if (!share) return null;
  const scenario = journey.lineMap.scenario === "general" ? null : journey.lineMap.name;
  return renderJourneyCard({ share, formCode: formInfo(c.formType)?.code ?? null, scenario, lang });
}

export const cardLang = (requested: string | null, locale: string): Lang => (requested === "es" || requested === "en" ? requested : locale === "es" ? "es" : "en");
