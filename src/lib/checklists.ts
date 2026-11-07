import { formInfo } from "./case-insights";

/**
 * Document checklists for common USCIS applications: what to gather before filing, from
 * USCIS's form instructions (reviewed on REVIEWED). General guidance, not legal advice:
 * every checklist links to the official form page, which has the current edition, fees
 * and filing address. Items marked `required: false` apply only to some people ("if it
 * applies"). People tick items as they gather them (src/lib/checklists-service.ts).
 */

type Bilingual = { en: string; es: string };
export type ChecklistItem = { key: string; title: Bilingual; detail?: Bilingual; required: boolean };
export type ChecklistGroup = { key: string; title: Bilingual; items: ChecklistItem[] };
export type Checklist = { key: string; form: string; title: Bilingual; summary: Bilingual; groups: ChecklistGroup[]; tips: Bilingual[]; links: { label: Bilingual; url: string }[] };

export const REVIEWED = "2026-11-07";

const b = (en: string, es: string): Bilingual => ({ en, es });
const item = (key: string, title: Bilingual, detail?: Bilingual, required = true): ChecklistItem => ({ key, title, detail, required });
const maybe = (key: string, title: Bilingual, detail?: Bilingual): ChecklistItem => item(key, title, detail, false);
const group = (key: string, title: Bilingual, items: ChecklistItem[]): ChecklistGroup => ({ key, title, items });
const formPage = (code: string) => ({ label: b(`Form ${code} on uscis.gov (instructions, fee, where to file)`, `Formulario ${code} en uscis.gov (instrucciones, tarifa, dónde enviarlo)`), url: `https://www.uscis.gov/${code.toLowerCase()}` });
const FEES = { label: b("USCIS fee calculator", "Calculadora de tarifas de USCIS"), url: "https://www.uscis.gov/feecalculator" };

// ---- Pieces many forms share ------------------------------------------------------------
const signed = (code: string) =>
  item("form", b(`Form ${code}, filled in and signed`, `Formulario ${code}, completo y firmado`), b("Use the current edition from uscis.gov. A form without a signature is rejected.", "Use la edición vigente de uscis.gov. Un formulario sin firma se rechaza."));
const photos = (n = 2) =>
  item(
    "photos",
    b(n === 1 ? "A passport-style photo" : `${n} passport-style photos`, n === 1 ? "Una foto tipo pasaporte" : `${n} fotos tipo pasaporte`),
    b("2 x 2 inches, taken in the last 30 days. Lightly write your name and A-Number (if you have one) on the back.", "De 2 x 2 pulgadas, tomadas en los últimos 30 días. Escriba suavemente su nombre y número A (si tiene) al reverso."),
  );
const photoId = item(
  "photo-id",
  b("Copy of a government-issued photo ID", "Copia de una identificación oficial con foto"),
  b("For example the photo page of your passport, a driver's license or a national ID card.", "Por ejemplo la página con foto de su pasaporte, una licencia de conducir o una cédula de identidad."),
);
const birth = item(
  "birth",
  b("Copy of your birth certificate", "Copia de su acta de nacimiento"),
  b("With a certified English translation if it isn't in English. If it can't be obtained, the instructions explain what to send instead.", "Con traducción certificada al inglés si no está en inglés. Si no se puede obtener, las instrucciones explican qué enviar en su lugar."),
);
const g28 = maybe("g28", b("Form G-28, if a lawyer or accredited representative helps you", "Formulario G-28, si le ayuda un abogado o representante acreditado"));
const police = maybe(
  "police",
  b("Certified police and court records, if you were ever arrested, charged or cited", "Registros policiales y judiciales certificados, si alguna vez lo arrestaron, acusaron o citaron"),
  b("The final court result for each one, even if it was dismissed or erased from your record.", "El resultado final de cada caso, aunque se haya desestimado o borrado de su historial."),
);
const nameChange = maybe(
  "name-change",
  b("Proof of any legal name change", "Prueba de cualquier cambio legal de nombre"),
  b("Marriage certificate, divorce decree or court order, if your name differs between documents.", "Acta de matrimonio, sentencia de divorcio u orden judicial, si su nombre cambia entre documentos."),
);
const priorMarriages = (who: Bilingual) =>
  maybe("prior-marriages", b(`Proof that any earlier marriages ended (${who.en})`, `Prueba de que terminó cualquier matrimonio anterior (${who.es})`), b("Divorce decrees, annulments or death certificates.", "Sentencias de divorcio, anulaciones o actas de defunción."));
const feeWaiver = maybe("fee-waiver", b("Form I-912, if you ask for a fee waiver", "Formulario I-912, si pide una exención de tarifa"), b("Only some forms and situations qualify. The form page says if yours does.", "Solo algunos formularios y situaciones califican. La página del formulario indica si el suyo aplica."));

/** Advice that applies to every application. */
export const COMMON_TIPS: Bilingual[] = [
  b("Send copies, not originals, unless the instructions or USCIS ask for originals.", "Envíe copias, no originales, salvo que las instrucciones o USCIS pidan los originales."),
  b("Anything not in English needs a full English translation with the translator's signed statement that it's accurate.", "Todo lo que no esté en inglés necesita una traducción completa al inglés con una declaración firmada del traductor de que es exacta."),
  b("Use the current edition of the form and sign it. Old editions and unsigned forms are rejected.", "Use la edición vigente del formulario y fírmelo. Las ediciones viejas y los formularios sin firma se rechazan."),
  b("Check the fee with USCIS's fee calculator and the filing address on the form page.", "Revise la tarifa con la calculadora de USCIS y la dirección de envío en la página del formulario."),
  b("Keep a full copy of everything you send.", "Guarde una copia completa de todo lo que envíe."),
];

export const CHECKLISTS: Checklist[] = [
  {
    key: "i-485",
    form: "I-485",
    title: b("Green card (adjustment of status)", "Green card (ajuste de estatus)"),
    summary: b("Applying for a green card from inside the U.S.", "Solicitar la green card desde dentro de EE. UU."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        signed("I-485"),
        item("i693", b("Form I-693, medical exam, in its sealed envelope", "Formulario I-693, examen médico, en su sobre sellado"), b("Done by a USCIS civil surgeon and sent with your application.", "Lo hace un médico civil autorizado por USCIS y se envía con su solicitud.")),
        maybe(
          "i864",
          b("Form I-864, Affidavit of Support, with your sponsor's evidence", "Formulario I-864, declaración jurada de patrocinio, con las pruebas del patrocinador"),
          b("For most family-based cases: the sponsor's latest federal tax return or transcript, W-2s and proof of status. Using a household member's income also needs Form I-864A.", "Para la mayoría de los casos familiares: la última declaración de impuestos federales o transcripción del patrocinador, sus W-2 y prueba de estatus. Si usa los ingresos de alguien del hogar, también el Formulario I-864A."),
        ),
        maybe("i765", b("Form I-765, if you want a work permit while you wait", "Formulario I-765, si quiere permiso de trabajo mientras espera")),
        maybe("i131", b("Form I-131, if you need to travel while you wait", "Formulario I-131, si necesita viajar mientras espera")),
        g28,
      ]),
      group("identity", b("Identity and entry", "Identidad y entrada"), [
        photos(2),
        photoId,
        birth,
        item(
          "entry",
          b("Copies of your passport visa page, entry stamp and Form I-94", "Copias de la visa de su pasaporte, el sello de entrada y el Formulario I-94"),
          b("Proof that you were inspected and admitted or paroled into the U.S., if you have it.", "Prueba de que fue inspeccionado y admitido o recibió parole en EE. UU., si la tiene."),
        ),
        maybe("status", b("Proof that you kept lawful status", "Prueba de que mantuvo su estatus legal"), b("Often needed in employment-based cases: your I-797 notices, I-20 or DS-2019, pay stubs.", "Suele pedirse en casos por empleo: sus avisos I-797, I-20 o DS-2019, talones de pago.")),
      ]),
      group("eligibility", b("What your case is based on", "En qué se basa su caso"), [
        item(
          "petition",
          b("The petition your green card is based on", "La petición en la que se basa su green card"),
          b("A copy of the approval notice (Form I-797) for the I-130, I-140 or other petition, or the petition itself if you file them together.", "Una copia del aviso de aprobación (Formulario I-797) del I-130, I-140 u otra petición, o la petición misma si las presenta juntas."),
        ),
        police,
      ]),
    ],
    tips: [b("Since December 2024 the medical exam (Form I-693) has to be sent with the I-485.", "Desde diciembre de 2024 el examen médico (Formulario I-693) se debe enviar junto con el I-485.")],
    links: [formPage("I-485"), FEES],
  },
  {
    key: "i-130",
    form: "I-130",
    title: b("Family petition", "Petición familiar"),
    summary: b("A U.S. citizen or green card holder asking for a relative.", "Un ciudadano o residente permanente pide a un familiar."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        signed("I-130"),
        maybe("i130a", b("Form I-130A, if you're petitioning for your spouse", "Formulario I-130A, si pide a su cónyuge"), b("With your spouse's information.", "Con la información de su cónyuge.")),
        g28,
      ]),
      group("you", b("Your status (the petitioner)", "Su estatus (el peticionario)"), [
        item(
          "status",
          b("Proof of your U.S. citizenship or green card", "Prueba de su ciudadanía estadounidense o green card"),
          b("A copy of your U.S. passport, U.S. birth certificate, naturalization or citizenship certificate, or both sides of your green card.", "Una copia de su pasaporte estadounidense, acta de nacimiento de EE. UU., certificado de naturalización o ciudadanía, o ambos lados de su green card."),
        ),
        nameChange,
      ]),
      group("relationship", b("Your relationship", "Su parentesco"), [
        item(
          "relationship",
          b("Proof of your relationship", "Prueba de su parentesco"),
          b(
            "Spouse: your marriage certificate. Child: the child's birth certificate showing your name. Parent: your birth certificate showing their name. Brother or sister: both birth certificates showing a parent in common.",
            "Cónyuge: su acta de matrimonio. Hijo: el acta de nacimiento del hijo con su nombre. Padre o madre: su acta de nacimiento con el nombre de ellos. Hermano: las actas de nacimiento de ambos con un padre en común.",
          ),
        ),
        priorMarriages(b("you and your spouse", "usted y su cónyuge")),
        maybe(
          "real-marriage",
          b("Evidence your marriage is real (spouse petitions)", "Pruebas de que su matrimonio es real (peticiones de cónyuge)"),
          b("For example a joint lease or mortgage, joint bank statements, insurance, your children's birth certificates and photos together over time.", "Por ejemplo un contrato de alquiler o hipoteca juntos, estados de cuenta conjuntos, seguros, actas de nacimiento de sus hijos y fotos juntos a lo largo del tiempo."),
        ),
        maybe("photos", b("Passport-style photos (spouse petitions)", "Fotos tipo pasaporte (peticiones de cónyuge)"), b("Two of you and two of your spouse.", "Dos suyas y dos de su cónyuge.")),
      ]),
    ],
    tips: [],
    links: [formPage("I-130"), FEES],
  },
  {
    key: "i-765",
    form: "I-765",
    title: b("Work permit", "Permiso de trabajo"),
    summary: b("Asking for an employment authorization document (EAD).", "Pedir un documento de autorización de empleo (EAD)."),
    groups: [
      group("forms", b("Forms", "Formularios"), [signed("I-765"), feeWaiver, g28]),
      group("identity", b("Identity", "Identidad"), [
        photos(2),
        item("photo-id", b("Copy of a photo ID", "Copia de una identificación con foto"), b("Your passport photo page, previous work permit, visa or national ID.", "La página con foto de su pasaporte, un permiso de trabajo anterior, una visa o su cédula.")),
        maybe("i94", b("Copy of your Form I-94, if you have one", "Copia de su Formulario I-94, si tiene uno")),
        maybe("old-ead", b("Your current or last work permit, front and back (renewals)", "Su permiso de trabajo actual o anterior, por ambos lados (renovaciones)")),
      ]),
      group("eligibility", b("Your eligibility", "Su elegibilidad"), [
        item(
          "category",
          b("Evidence for your eligibility category", "Pruebas de su categoría de elegibilidad"),
          b("For example the receipt notice of your pending green card application (c)(9), of your asylum application (c)(8), or the approval that makes you eligible.", "Por ejemplo el aviso de recibo de su solicitud de green card pendiente (c)(9), de su solicitud de asilo (c)(8), o la aprobación que lo hace elegible."),
        ),
      ]),
    ],
    tips: [b("Write the right eligibility category code on the form; the instructions list them.", "Escriba el código correcto de su categoría de elegibilidad en el formulario; las instrucciones los enumeran.")],
    links: [formPage("I-765"), FEES],
  },
  {
    key: "i-131",
    form: "I-131",
    title: b("Travel document", "Documento de viaje"),
    summary: b("Advance parole, a reentry permit or a refugee travel document.", "Permiso adelantado (advance parole), permiso de reingreso o documento de viaje de refugiado."),
    groups: [
      group("forms", b("Forms", "Formularios"), [signed("I-131"), g28]),
      group("identity", b("Identity", "Identidad"), [
        photos(2),
        photoId,
        maybe("green-card", b("Copy of your green card, front and back (reentry permit)", "Copia de su green card, por ambos lados (permiso de reingreso)")),
        maybe("i94", b("Copy of your Form I-94, if you have one", "Copia de su Formulario I-94, si tiene uno")),
      ]),
      group("reason", b("The document you're asking for", "El documento que pide"), [
        item(
          "basis",
          b("Evidence for the document you need", "Pruebas para el documento que necesita"),
          b("Advance parole while your green card is pending: the I-485 receipt notice. Refugee travel document: proof of your asylee or refugee status.", "Advance parole mientras su green card está pendiente: el aviso de recibo del I-485. Documento de viaje de refugiado: prueba de su estatus de asilado o refugiado."),
        ),
        maybe(
          "purpose",
          b("Why you need to travel (humanitarian or emergency parole)", "Por qué necesita viajar (parole humanitario o de emergencia)"),
          b("A letter explaining the reason, with evidence such as a doctor's letter or a death certificate.", "Una carta que explique el motivo, con pruebas como una carta médica o un acta de defunción."),
        ),
      ]),
    ],
    tips: [b("If your green card application is pending, leaving the U.S. without advance parole can end it. Wait for the document before you travel.", "Si su solicitud de green card está pendiente, salir de EE. UU. sin advance parole puede terminarla. Espere el documento antes de viajar.")],
    links: [formPage("I-131"), FEES],
  },
  {
    key: "i-90",
    form: "I-90",
    title: b("Renew or replace a green card", "Renovar o reemplazar la green card"),
    summary: b("A 10-year card that's expiring, lost, stolen or wrong.", "Una tarjeta de 10 años que vence, se perdió, se la robaron o tiene errores."),
    groups: [
      group("forms", b("Forms", "Formularios"), [signed("I-90"), g28]),
      group("card", b("Your card", "Su tarjeta"), [
        item(
          "card-copy",
          b("Copy of your green card, front and back", "Copia de su green card, por ambos lados"),
          b("If it was lost, stolen or destroyed: a copy of a government-issued photo ID instead.", "Si se perdió, se la robaron o se destruyó: en su lugar, copia de una identificación oficial con foto."),
        ),
        nameChange,
        maybe("uscis-error", b("If USCIS made a mistake on the card: the card and proof of the right information", "Si USCIS cometió un error en la tarjeta: la tarjeta y prueba de la información correcta")),
      ]),
    ],
    tips: [b("A 2-year (conditional) card isn't renewed with Form I-90: file Form I-751 or I-829 instead.", "Una tarjeta de 2 años (condicional) no se renueva con el Formulario I-90: presente el Formulario I-751 o I-829.")],
    links: [formPage("I-90"), FEES],
  },
  {
    key: "i-751",
    form: "I-751",
    title: b("Remove conditions on residence", "Quitar las condiciones de la residencia"),
    summary: b("Turning a 2-year green card from marriage into a 10-year card.", "Convertir una green card de 2 años por matrimonio en una de 10 años."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        item("form", b("Form I-751, signed by both spouses", "Formulario I-751, firmado por ambos cónyuges"), b("If you file alone with a waiver, only you sign.", "Si lo presenta solo con una exención, solo firma usted.")),
        g28,
      ]),
      group("card", b("Your card", "Su tarjeta"), [item("card-copy", b("Copy of your conditional green card, front and back", "Copia de su green card condicional, por ambos lados"), b("And of any children included in the petition.", "Y de los hijos incluidos en la petición."))]),
      group("marriage", b("Evidence of your marriage", "Pruebas de su matrimonio"), [
        item("joint-taxes", b("Joint tax returns or transcripts", "Declaraciones de impuestos conjuntas o transcripciones")),
        item("joint-finances", b("Joint bank accounts, credit cards or loans", "Cuentas bancarias, tarjetas de crédito o préstamos conjuntos")),
        item("joint-home", b("Lease, mortgage or utility bills with both names", "Contrato de alquiler, hipoteca o facturas de servicios con ambos nombres")),
        maybe("insurance", b("Insurance listing each other", "Seguros donde aparezcan uno al otro")),
        maybe("children", b("Birth certificates of children you have together", "Actas de nacimiento de hijos en común")),
        maybe("photos-together", b("Photos together over time", "Fotos juntos a lo largo del tiempo")),
        maybe("affidavits", b("Sworn statements from people who know you as a couple", "Declaraciones juradas de personas que los conocen como pareja"), b("With each person's contact details and how they know you.", "Con los datos de contacto de cada persona y cómo los conoce.")),
      ]),
      group("other", b("If it applies", "Si aplica"), [
        maybe("waiver", b("If you file alone: the divorce decree, or evidence of abuse or hardship", "Si lo presenta solo: la sentencia de divorcio, o pruebas de abuso o dificultad extrema")),
        police,
      ]),
    ],
    tips: [b("File jointly in the 90 days before your card expires.", "Preséntelo en conjunto en los 90 días antes de que venza su tarjeta.")],
    links: [formPage("I-751"), FEES],
  },
  {
    key: "n-400",
    form: "N-400",
    title: b("Citizenship (naturalization)", "Ciudadanía (naturalización)"),
    summary: b("Applying to become a U.S. citizen.", "Solicitar la ciudadanía estadounidense."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        signed("N-400"),
        feeWaiver,
        maybe("n648", b("Form N-648, if a disability keeps you from taking the English or civics test", "Formulario N-648, si una discapacidad le impide tomar el examen de inglés o de cívica")),
        maybe("n426", b("Form N-426, if you apply through military service", "Formulario N-426, si solicita por servicio militar")),
        g28,
      ]),
      group("identity", b("Identity", "Identidad"), [
        item("green-card", b("Copy of your green card, front and back", "Copia de su green card, por ambos lados")),
        maybe("photos", b("2 passport-style photos, only if you live outside the U.S.", "2 fotos tipo pasaporte, solo si vive fuera de EE. UU.")),
      ]),
      group("marriage", b("If you apply after 3 years married to a U.S. citizen", "Si solicita tras 3 años casado con un ciudadano"), [
        maybe("spouse-citizenship", b("Proof of your spouse's U.S. citizenship", "Prueba de la ciudadanía de su cónyuge")),
        maybe("marriage-cert", b("Your marriage certificate", "Su acta de matrimonio")),
        priorMarriages(b("you and your spouse", "usted y su cónyuge")),
      ]),
      group("other", b("If it applies", "Si aplica"), [
        police,
        maybe("taxes", b("IRS tax transcripts and any payment plan, if you owe taxes", "Transcripciones de impuestos del IRS y cualquier plan de pago, si debe impuestos")),
        maybe("child-support", b("Proof of child support payments, if a court ordered them", "Prueba de pagos de manutención, si un tribunal los ordenó")),
      ]),
    ],
    tips: [b("Bring the originals of these documents to your interview.", "Lleve los originales de estos documentos a su entrevista.")],
    links: [formPage("N-400"), FEES, { label: b("Practice the civics test", "Practique el examen de cívica"), url: "/civics-test" }],
  },
  {
    key: "i-129f",
    form: "I-129F",
    title: b("Fiancé(e) petition", "Petición de prometido(a)"),
    summary: b("A U.S. citizen asking for a fiancé(e) to come and marry in the U.S.", "Un ciudadano pide a su prometido(a) para casarse en EE. UU."),
    groups: [
      group("forms", b("Forms", "Formularios"), [signed("I-129F"), g28]),
      group("you", b("You and your fiancé(e)", "Usted y su prometido(a)"), [
        item("citizenship", b("Proof of your U.S. citizenship", "Prueba de su ciudadanía estadounidense"), b("Your U.S. passport, birth certificate or naturalization certificate.", "Su pasaporte estadounidense, acta de nacimiento o certificado de naturalización.")),
        photos(1),
        item("fiance-photo", b("A passport-style photo of your fiancé(e)", "Una foto tipo pasaporte de su prometido(a)")),
        priorMarriages(b("both of you", "ambos")),
        nameChange,
      ]),
      group("relationship", b("Your relationship", "Su relación"), [
        item("met", b("Proof you met in person in the last 2 years", "Prueba de que se conocieron en persona en los últimos 2 años"), b("Photos together, travel tickets and hotel receipts, or evidence for a waiver.", "Fotos juntos, boletos de viaje y recibos de hotel, o pruebas para una exención.")),
        item("intent", b("Signed statements from both of you that you plan to marry within 90 days", "Declaraciones firmadas de ambos de que planean casarse dentro de 90 días"), b("Within 90 days of your fiancé(e)'s arrival in the U.S.", "Dentro de los 90 días de la llegada de su prometido(a) a EE. UU.")),
        maybe("imbra", b("If you met through an international marriage broker, or have certain criminal convictions: what the instructions ask for", "Si se conocieron por una agencia matrimonial internacional, o tiene ciertas condenas: lo que piden las instrucciones")),
      ]),
    ],
    tips: [],
    links: [formPage("I-129F"), FEES],
  },
  {
    key: "i-539",
    form: "I-539",
    title: b("Extend or change your stay", "Extender o cambiar su estancia"),
    summary: b("More time in the U.S. or a new nonimmigrant status.", "Más tiempo en EE. UU. o un nuevo estatus de no inmigrante."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        signed("I-539"),
        maybe("i539a", b("Form I-539A for each family member included", "Formulario I-539A para cada familiar incluido")),
        g28,
      ]),
      group("status", b("Your current stay", "Su estancia actual"), [
        item("i94", b("Copy of Form I-94 for each person", "Copia del Formulario I-94 de cada persona")),
        item("passport", b("Copy of each person's valid passport", "Copia del pasaporte vigente de cada persona")),
      ]),
      group("reason", b("Your reason", "Su motivo"), [
        item("why", b("Evidence of why you need more time or a new status", "Pruebas de por qué necesita más tiempo o un nuevo estatus"), b("For example a letter explaining the reason, a doctor's letter, or for student status Form I-20 and the SEVIS fee receipt.", "Por ejemplo una carta que explique el motivo, una carta médica, o para estatus de estudiante el Formulario I-20 y el recibo de la tarifa SEVIS.")),
        item("support", b("Proof you can support yourself during the stay", "Prueba de que puede mantenerse durante la estancia"), b("Bank statements or a letter of support.", "Estados de cuenta o una carta de apoyo económico.")),
        maybe("relationship", b("Marriage or birth certificates for family members included", "Actas de matrimonio o de nacimiento de los familiares incluidos")),
      ]),
    ],
    tips: [b("File before your current authorized stay ends.", "Preséntelo antes de que termine su estancia autorizada actual.")],
    links: [formPage("I-539"), FEES],
  },
  {
    key: "i-821d",
    form: "I-821D",
    title: b("DACA renewal", "Renovación de DACA"),
    summary: b("Renewing Deferred Action for Childhood Arrivals and its work permit.", "Renovar la Acción Diferida para los Llegados en la Infancia y su permiso de trabajo."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        signed("I-821D"),
        item("i765", b("Form I-765, signed", "Formulario I-765, firmado")),
        item("i765ws", b("Form I-765WS worksheet", "Hoja de trabajo Formulario I-765WS")),
        g28,
      ]),
      group("identity", b("Identity", "Identidad"), [photos(2), item("ead", b("Copy of your current or last work permit, front and back", "Copia de su permiso de trabajo actual o anterior, por ambos lados"))]),
      group("other", b("If it applies", "Si aplica"), [maybe("police", b("Court records for any arrest or charge since your last approval", "Registros judiciales de cualquier arresto o cargo desde su última aprobación"))]),
    ],
    tips: [
      b("USCIS suggests filing 120 to 150 days before your current DACA ends.", "USCIS sugiere presentarlo de 120 a 150 días antes de que termine su DACA actual."),
      b("Court decisions change DACA often; check the DACA page for the latest.", "Las decisiones judiciales cambian DACA con frecuencia; revise la página de DACA para lo más reciente."),
    ],
    links: [formPage("I-821D"), FEES],
  },
  {
    key: "i-821",
    form: "I-821",
    title: b("Temporary Protected Status (TPS)", "Estatus de Protección Temporal (TPS)"),
    summary: b("Registering or re-registering for TPS.", "Inscribirse o reinscribirse en TPS."),
    groups: [
      group("forms", b("Forms", "Formularios"), [signed("I-821"), maybe("i765", b("Form I-765, if you want a work permit", "Formulario I-765, si quiere permiso de trabajo")), feeWaiver, g28]),
      group("identity", b("Identity and nationality", "Identidad y nacionalidad"), [
        item("nationality", b("Proof of your identity and nationality", "Prueba de su identidad y nacionalidad"), b("A passport, a birth certificate with a photo ID, or a national identity document.", "Un pasaporte, un acta de nacimiento con identificación con foto, o un documento nacional de identidad.")),
        maybe("photos", b("2 passport-style photos, if you also ask for a work permit", "2 fotos tipo pasaporte, si también pide permiso de trabajo")),
      ]),
      group("residence", b("Your time in the U.S. (first-time applicants)", "Su tiempo en EE. UU. (primera vez)"), [
        maybe(
          "residence",
          b("Proof you entered and have lived in the U.S. since the required dates", "Prueba de que entró y ha vivido en EE. UU. desde las fechas requeridas"),
          b("For example rent receipts or a lease, utility bills, pay stubs, school or medical records. Your country's TPS page lists the dates.", "Por ejemplo recibos de renta o contrato, facturas de servicios, talones de pago, registros escolares o médicos. La página de TPS de su país indica las fechas."),
        ),
      ]),
    ],
    tips: [b("Each country has its own registration period; file within it.", "Cada país tiene su propio periodo de inscripción; preséntelo dentro de ese plazo.")],
    links: [formPage("I-821"), FEES],
  },
  {
    key: "i-589",
    form: "I-589",
    title: b("Asylum", "Asilo"),
    summary: b("Asking for asylum with USCIS (affirmative asylum).", "Pedir asilo ante USCIS (asilo afirmativo)."),
    groups: [
      group("forms", b("Forms", "Formularios"), [
        item("form", b("Form I-589, signed by you and anyone included", "Formulario I-589, firmado por usted y quien incluya")),
        item("copies", b("Copies of the full application, as the instructions ask", "Copias de la solicitud completa, como piden las instrucciones"), b("Including an extra copy for each family member you include.", "Incluida una copia adicional por cada familiar que incluya.")),
        g28,
      ]),
      group("identity", b("Identity", "Identidad"), [
        item("photos", b("A passport-style photo of you and of each family member included", "Una foto tipo pasaporte suya y de cada familiar incluido")),
        maybe("passport", b("Copies of passports, travel documents and Form I-94, if you have them", "Copias de pasaportes, documentos de viaje y Formulario I-94, si los tiene")),
        maybe("id-docs", b("Birth certificates or other identity documents", "Actas de nacimiento u otros documentos de identidad")),
        maybe("relationship", b("Marriage and birth certificates for your spouse and children included", "Actas de matrimonio y de nacimiento de su cónyuge e hijos incluidos")),
      ]),
      group("claim", b("Your claim", "Su caso"), [
        item("statement", b("Your detailed written statement", "Su declaración escrita detallada"), b("In your own words: what happened, who harmed you or why you fear harm, and why you can't get protection in your country.", "Con sus propias palabras: qué pasó, quién le hizo daño o por qué teme que se lo hagan, y por qué no puede obtener protección en su país.")),
        item("evidence", b("Evidence that supports your statement", "Pruebas que respalden su declaración"), b("Police or medical reports, letters from witnesses, membership cards, news articles and reports on conditions in your country.", "Informes policiales o médicos, cartas de testigos, credenciales de membresía, noticias e informes sobre la situación en su país.")),
      ]),
    ],
    tips: [
      b("Generally you must apply within 1 year of arriving in the U.S.; there are some exceptions.", "Por lo general debe solicitar dentro de 1 año de su llegada a EE. UU.; hay algunas excepciones."),
      b("Asylum cases are complex: free or low-cost legal help can make a big difference.", "Los casos de asilo son complejos: la ayuda legal gratuita o de bajo costo puede hacer una gran diferencia."),
    ],
    links: [formPage("I-589"), { label: b("Find legal help (USCIS)", "Buscar ayuda legal (USCIS)"), url: "https://www.uscis.gov/scams-fraud-and-misconduct/avoid-scams/find-legal-services" }],
  },
];

const BY_KEY = new Map(CHECKLISTS.map((c) => [c.key, c]));
export const checklistByKey = (key: string) => BY_KEY.get(key) ?? null;
/** The checklist for a case's form (I-485 → the green card checklist), if there is one. */
export function checklistForForm(formType: string | null | undefined): Checklist | null {
  const code = formInfo(formType)?.code;
  return code ? (CHECKLISTS.find((c) => c.form === code) ?? null) : null;
}
export const checklistPath = (key: string) => `/checklists/${key}`;
export const checklistItems = (c: Checklist) => c.groups.flatMap((g) => g.items);
/** Counts toward "ready": the required items plus any optional ones the person ticked. */
export function checklistProgress(c: Checklist, done: Iterable<string>) {
  const ticked = new Set(done);
  const items = checklistItems(c);
  const required = items.filter((i) => i.required);
  return { required: required.length, requiredDone: required.filter((i) => ticked.has(i.key)).length, done: items.filter((i) => ticked.has(i.key)).length, total: items.length };
}

/** The checklist list as the app and API show it. */
export function checklistSummaries() {
  return CHECKLISTS.map((c) => ({ key: c.key, form: c.form, title: c.title, summary: c.summary, total: checklistItems(c).length, required: checklistItems(c).filter((i) => i.required).length }));
}
