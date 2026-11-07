/**
 * Immigration court (EOIR) cases: a guide and EOIR's own tools.
 *
 * Immigration courts belong to the Department of Justice's Executive Office
 * for Immigration Review (EOIR), not USCIS. EOIR has no public API, and its
 * case information site isn't for automated use, so CasePingo never checks
 * court cases and its servers never receive A-Numbers: it explains where to
 * look and links to the official sites. (The app can keep a court case and its
 * next hearing on the phone, for reminders.) The website shows this guide and the API sends it to
 * the app, so wording can improve without an app release.
 */

type Bilingual = { en: string; es: string };
export type CourtLink = { url: string; label: Bilingual; text?: Bilingual };

/** When the facts below were last checked against EOIR's pages. */
export const COURT_REVIEWED = "2026-11-07";

export const EOIR_CASE_INFO_URL = "https://acis.eoir.justice.gov/en/";
export const EOIR_PHONE = { display: "1-800-898-7180", tel: "tel:+18008987180", tdd: "1-800-828-1120" };

export const COURT_GUIDE = {
  title: { en: "Immigration court", es: "Corte de inmigración" },
  intro: {
    en: "Immigration court cases are handled by the Executive Office for Immigration Review (EOIR), part of the Department of Justice, not USCIS. CasePingo can't check them for you, but EOIR's own tools can, with your A-Number.",
    es: "Los casos de la corte de inmigración los lleva la Oficina Ejecutiva de Revisión de Casos de Inmigración (EOIR), parte del Departamento de Justicia, no USCIS. CasePingo no puede consultarlos por usted, pero las herramientas de EOIR sí, con su número A.",
  },
  aNumber: {
    title: { en: "Your A-Number", es: "Su número A" },
    text: {
      en: "Your A-Number (Alien Registration Number) is the letter A followed by 8 or 9 digits. It's on your Notice to Appear and other notices from the court or the Department of Homeland Security. If it has 8 digits, put a 0 in front.",
      es: "Su número A (número de registro de extranjero) es la letra A seguida de 8 o 9 dígitos. Aparece en su Aviso de Comparecencia y en otros avisos de la corte o del Departamento de Seguridad Nacional. Si tiene 8 dígitos, agregue un 0 al principio.",
    },
  },
  ways: [
    {
      key: "online",
      title: { en: "Check online", es: "Consulte en línea" },
      text: {
        en: "Enter your A-Number and your nationality on EOIR's case information site to see your next hearing (date, time and court) and the judge's decision.",
        es: "Ingrese su número A y su nacionalidad en el sitio de información de casos de EOIR para ver su próxima audiencia (fecha, hora y corte) y la decisión del juez.",
      },
      link: { url: EOIR_CASE_INFO_URL, label: { en: "Open EOIR case information", es: "Abrir la información de casos de EOIR" } },
    },
    {
      key: "phone",
      title: { en: "Call the automated line", es: "Llame a la línea automatizada" },
      text: {
        en: `${EOIR_PHONE.display} (TDD ${EOIR_PHONE.tdd}), in English and Spanish. Enter your A-Number when asked.`,
        es: `${EOIR_PHONE.display} (TDD ${EOIR_PHONE.tdd}), en inglés y español. Marque su número A cuando se lo pidan.`,
      },
      link: { url: EOIR_PHONE.tel, label: { en: `Call ${EOIR_PHONE.display}`, es: `Llamar al ${EOIR_PHONE.display}` } },
    },
  ],
  tips: [
    {
      en: "Never miss a hearing. If you can't go, talk to the court or a lawyer before the date.",
      es: "No falte nunca a una audiencia. Si no puede ir, hable con la corte o con un abogado antes de la fecha.",
    },
    {
      en: "If you move, tell the court within 5 working days with Form EOIR-33/IC. Telling USCIS or ICE isn't enough.",
      es: "Si se muda, avise a la corte en un plazo de 5 días hábiles con el Formulario EOIR-33/IC. Avisar a USCIS o a ICE no es suficiente.",
    },
    {
      en: "The online tool doesn't cover bond hearings or motions. Ask your immigration court about those.",
      es: "La herramienta en línea no incluye audiencias de fianza ni mociones. Pregunte por ellas en su corte de inmigración.",
    },
    {
      en: "Only documents from the court or the Board of Immigration Appeals are official.",
      es: "Solo los documentos de la corte o de la Junta de Apelaciones de Inmigración son oficiales.",
    },
  ],
  links: [
    {
      url: "https://respondentaccess.eoir.justice.gov/en/",
      label: { en: "EOIR Respondent Access", es: "EOIR Respondent Access (acceso para el demandado)" },
      text: { en: "See your case documents and file some forms online if you don't have a lawyer.", es: "Vea los documentos de su caso y presente algunos formularios en línea si no tiene abogado." },
    },
    {
      url: "https://respondentaccess.eoir.justice.gov/en/forms/eoir33ic/",
      label: { en: "Change your address with the court (EOIR-33/IC)", es: "Cambie su dirección ante la corte (EOIR-33/IC)" },
    },
    {
      url: "https://www.justice.gov/eoir/find-immigration-court-and-access-internet-based-hearings",
      label: { en: "Find your immigration court", es: "Encuentre su corte de inmigración" },
    },
    {
      url: "https://www.justice.gov/eoir/find-legal-representation",
      label: { en: "Find free or low-cost legal help", es: "Encuentre ayuda legal gratuita o de bajo costo" },
    },
  ] satisfies CourtLink[],
  note: {
    en: "CasePingo doesn't check immigration court cases, and its servers never receive A-Numbers (court cases you add in the app stay on your phone). These links open EOIR's official websites.",
    es: "CasePingo no consulta casos de la corte de inmigración y sus servidores nunca reciben números A (los casos de la corte que agregue en la aplicación se quedan en su teléfono). Estos enlaces abren los sitios oficiales de EOIR.",
  },
};

export type CourtGuide = typeof COURT_GUIDE;
