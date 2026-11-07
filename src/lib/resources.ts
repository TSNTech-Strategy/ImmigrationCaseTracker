/**
 * CasePingo's resource center: short, plain-language guides in English and
 * Spanish, with links to the official sources. General information only, never
 * legal advice; official pages always win.
 *
 * Published on the website at /resources and sent to the app by
 * GET /api/v1/resources, so wording can improve without an app release.
 * Internal links use website paths ("/status-guide"); the app maps them to its
 * own screens. Links marked webOnly (pricing) are left out of the app.
 */

export type Text = { en: string; es: string };
export type ResourceLink = { label: Text; url: string; webOnly?: boolean };
export type ResourceSection = { heading: Text; paragraphs?: Text[]; bullets?: Text[] };
export type FaqItem = { q: Text; a: Text; links?: ResourceLink[] };
export type ResourceIcon = { ios: string; md: string; tint: "blue" | "green" | "orange" | "pink" | "purple" | "teal" };

export type Resource = {
  slug: string;
  icon: ResourceIcon;
  title: Text;
  /** One line for the card. */
  summary: Text;
  intro: Text;
  sections: ResourceSection[];
  faq?: FaqItem[];
  links: ResourceLink[];
};

const L = {
  processingTimes: { label: { en: "USCIS processing times", es: "Tiempos de procesamiento de USCIS" }, url: "https://egov.uscis.gov/processing-times/" },
  contactCenter: { label: { en: "USCIS Contact Center", es: "Centro de Contacto de USCIS" }, url: "https://www.uscis.gov/contactcenter" },
  addressChange: { label: { en: "Change your address with USCIS", es: "Cambiar su dirección con USCIS" }, url: "https://www.uscis.gov/addresschange" },
  caseStatus: { label: { en: "USCIS Case Status Online", es: "Estado de casos en línea de USCIS" }, url: "https://egov.uscis.gov/" },
  account: { label: { en: "Your USCIS online account", es: "Su cuenta en línea de USCIS" }, url: "https://my.uscis.gov/" },
  newsroom: { label: { en: "USCIS Newsroom", es: "Sala de prensa de USCIS" }, url: "https://www.uscis.gov/newsroom" },
  policyManual: { label: { en: "USCIS Policy Manual", es: "Manual de Políticas de USCIS" }, url: "https://www.uscis.gov/policy-manual" },
  citizenship: { label: { en: "Citizenship Resource Center (civics and English study)", es: "Centro de Recursos de Ciudadanía (estudio de cívica e inglés)" }, url: "https://www.uscis.gov/citizenship" },
  legalHelp: { label: { en: "Find legal help (USCIS)", es: "Buscar ayuda legal (USCIS)" }, url: "https://www.uscis.gov/scams-fraud-and-misconduct/avoid-scams/find-legal-services" },
  statusLibrary: { label: { en: "What your status means", es: "Qué significa su estado" }, url: "/status-guide" },
  visaBulletin: { label: { en: "Visa Bulletin", es: "Boletín de Visas" }, url: "/visa-bulletin" },
  processingGuide: { label: { en: "How to read processing times", es: "Cómo leer los tiempos de procesamiento" }, url: "/resources/processing-times" },
  faq: { label: { en: "Frequently asked questions", es: "Preguntas frecuentes" }, url: "/resources/faq" },
  civicsTest: { label: { en: "Practice the civics test (official questions)", es: "Practique el examen de cívica (preguntas oficiales)" }, url: "/civics-test" },
} satisfies Record<string, ResourceLink>;

export const RESOURCES: Resource[] = [
  {
    slug: "processing-times",
    icon: { ios: "clock", md: "schedule", tint: "blue" },
    title: { en: "Processing times", es: "Tiempos de procesamiento" },
    summary: { en: "How to read USCIS's official times for your form and office.", es: "Cómo leer los tiempos oficiales de USCIS para su formulario y oficina." },
    intro: {
      en: "USCIS publishes how long it has recently taken to finish cases, by form, category and office. It's an estimate, not a promise: some cases take longer.",
      es: "USCIS publica cuánto ha tardado recientemente en terminar los casos, por formulario, categoría y oficina. Es un cálculo, no una promesa: algunos casos tardan más.",
    },
    sections: [
      {
        heading: { en: "Look up your case", es: "Busque su caso" },
        bullets: [
          { en: "Open USCIS's processing times page (link below).", es: "Abra la página de tiempos de procesamiento de USCIS (enlace abajo)." },
          { en: "Choose your form (for example I-130, I-485 or N-400) and its category.", es: "Elija su formulario (por ejemplo I-130, I-485 o N-400) y su categoría." },
          {
            en: "Choose the office handling your case. It's on your receipt notice, and CasePingo shows it on your case page.",
            es: "Elija la oficina que lleva su caso. Aparece en su aviso de recibo, y CasePingo la muestra en la página de su caso.",
          },
          {
            en: "Read the time shown: how long USCIS has recently taken to complete most cases like yours.",
            es: "Lea el tiempo indicado: cuánto ha tardado USCIS recientemente en completar la mayoría de los casos como el suyo.",
          },
        ],
      },
      {
        heading: { en: "If your case is taking longer", es: "Si su caso tarda más" },
        paragraphs: [
          {
            en: "The same page tells you from which receipt date you can send USCIS a case inquiry. If the receipt date on your notice is earlier, your case is outside normal processing time: you can ask USCIS about it online or through the USCIS Contact Center.",
            es: "La misma página indica desde qué fecha de recibo puede enviar una consulta a USCIS. Si la fecha de recibo de su aviso es anterior, su caso está fuera del tiempo normal de procesamiento: puede consultar a USCIS por internet o por el Centro de Contacto de USCIS.",
          },
          { en: "Times are updated regularly and can go up or down.", es: "Los tiempos se actualizan con frecuencia y pueden subir o bajar." },
        ],
      },
      {
        heading: { en: "While you wait", es: "Mientras espera" },
        bullets: [
          { en: "Keep your address up to date with USCIS so you don't miss mail.", es: "Mantenga su dirección actualizada con USCIS para no perder correspondencia." },
          { en: "CasePingo checks your case and tells you when the status changes.", es: "CasePingo revisa su caso y le avisa cuando cambia el estado." },
        ],
      },
    ],
    links: [L.processingTimes, L.contactCenter, L.addressChange],
  },
  {
    slug: "interviews",
    icon: { ios: "person.2", md: "groups", tint: "green" },
    title: { en: "Interviews", es: "Entrevistas" },
    summary: { en: "Who gets one, what to bring, and what to expect on the day.", es: "Quién tiene una, qué llevar y qué esperar ese día." },
    intro: {
      en: "Many green card and citizenship cases include an interview with a USCIS officer. Immigrant visa interviews abroad happen at a U.S. embassy or consulate instead.",
      es: "Muchos casos de green card y de ciudadanía incluyen una entrevista con un oficial de USCIS. Las entrevistas de visa de inmigrante en el extranjero se hacen en una embajada o consulado de EE. UU.",
    },
    sections: [
      {
        heading: { en: "Common interviews", es: "Entrevistas comunes" },
        bullets: [
          {
            en: "Green card (adjustment of status): questions about your application and eligibility. Marriage cases often include questions about the relationship.",
            es: "Green card (ajuste de estatus): preguntas sobre su solicitud y su elegibilidad. En los casos de matrimonio suelen preguntar sobre la relación.",
          },
          {
            en: "Citizenship (N-400): questions about your application, plus the English and civics tests unless you qualify for an exception.",
            es: "Ciudadanía (N-400): preguntas sobre su solicitud, además de los exámenes de inglés y de educación cívica, salvo que califique para una excepción.",
          },
          {
            en: "Immigrant visa (abroad): an interview at a U.S. embassy or consulate, run by the State Department.",
            es: "Visa de inmigrante (en el extranjero): una entrevista en una embajada o consulado de EE. UU., a cargo del Departamento de Estado.",
          },
          { en: "Some cases are decided without an interview.", es: "Algunos casos se deciden sin entrevista." },
        ],
      },
      {
        heading: { en: "What to bring", es: "Qué llevar" },
        paragraphs: [{ en: "Your interview notice lists what to bring for your case. It usually includes:", es: "Su aviso de entrevista indica qué llevar en su caso. Normalmente incluye:" }],
        bullets: [
          { en: "The interview notice itself.", es: "El aviso de entrevista." },
          { en: "A government-issued photo ID, such as a passport or driver's license.", es: "Una identificación oficial con foto, como un pasaporte o una licencia de conducir." },
          {
            en: "Originals of documents you sent copies of, such as birth and marriage certificates, with certified English translations.",
            es: "Los originales de los documentos que envió en copia, como actas de nacimiento y de matrimonio, con traducciones certificadas al inglés.",
          },
          { en: "Any immigration documents you have, such as a work permit or travel document.", es: "Cualquier documento migratorio que tenga, como un permiso de trabajo o un documento de viaje." },
          {
            en: "For marriage cases, evidence of your life together, such as a joint lease, shared bills or photos.",
            es: "En casos de matrimonio, pruebas de su vida en común, como un contrato de alquiler conjunto, cuentas compartidas o fotos.",
          },
        ],
      },
      {
        heading: { en: "On the day", es: "El día de la entrevista" },
        bullets: [
          { en: "Arrive early: there's a security check at the entrance.", es: "Llegue temprano: hay un control de seguridad en la entrada." },
          {
            en: "The officer will put you under oath. Answer truthfully; if you don't understand a question, ask them to repeat it.",
            es: "El oficial le tomará juramento. Responda con la verdad; si no entiende una pregunta, pida que la repitan.",
          },
          { en: "You may bring a lawyer or accredited representative (they file Form G-28).", es: "Puede ir con un abogado o un representante acreditado (ellos presentan el Formulario G-28)." },
          {
            en: "If you need an interpreter, follow the instructions on your notice; the rules depend on the type of interview.",
            es: "Si necesita intérprete, siga las instrucciones de su aviso; las reglas dependen del tipo de entrevista.",
          },
        ],
      },
      {
        heading: { en: "If you can't go, and what happens after", es: "Si no puede asistir, y qué pasa después" },
        bullets: [
          {
            en: "To reschedule, follow your notice's instructions as early as you can. Missing an interview without rescheduling can delay or end your case.",
            es: "Para reprogramar, siga las instrucciones de su aviso lo antes posible. Faltar a una entrevista sin reprogramar puede retrasar o terminar su caso.",
          },
          {
            en: "You may get a decision at the interview, a request for more documents, or a notice later. CasePingo tells you when your status changes.",
            es: "Puede recibir una decisión en la entrevista, una solicitud de más documentos o un aviso más tarde. CasePingo le avisa cuando cambia su estado.",
          },
        ],
      },
    ],
    links: [L.civicsTest, L.citizenship, L.contactCenter, L.statusLibrary],
  },
  {
    slug: "news",
    icon: { ios: "newspaper", md: "newspaper", tint: "orange" },
    title: { en: "News and official updates", es: "Noticias y avisos oficiales" },
    summary: { en: "USCIS alerts, policy changes and the monthly Visa Bulletin, from the source.", es: "Alertas de USCIS, cambios de políticas y el Boletín de Visas mensual, desde la fuente." },
    intro: {
      en: "Immigration rules and procedures change. These official pages are where changes are announced first.",
      es: "Las reglas y los procedimientos migratorios cambian. Estas páginas oficiales son donde se anuncian primero los cambios.",
    },
    sections: [
      {
        heading: { en: "Where to look", es: "Dónde buscar" },
        bullets: [
          { en: "USCIS Newsroom: news releases and alerts, such as new forms, fees and office changes.", es: "Sala de prensa de USCIS: comunicados y alertas, como formularios nuevos, tarifas y cambios de oficinas." },
          { en: "USCIS Policy Manual: USCIS's official policies, updated when they change.", es: "Manual de Políticas de USCIS: las políticas oficiales de USCIS, actualizadas cuando cambian." },
          { en: "Visa Bulletin: the State Department's monthly green card cut-off dates.", es: "Boletín de Visas: las fechas límite mensuales de green card del Departamento de Estado." },
        ],
      },
      {
        heading: { en: "Watch out for scams", es: "Cuidado con las estafas" },
        bullets: [
          {
            en: "USCIS never asks for payment by gift card, by wire transfer or to a person. Official USCIS emails and websites end in .gov.",
            es: "USCIS nunca pide pagos con tarjetas de regalo, por transferencia ni a una persona. Los correos y sitios oficiales de USCIS terminan en .gov.",
          },
          {
            en: "Only lawyers and accredited representatives can give immigration legal advice. Be careful with \"notarios\".",
            es: "Solo los abogados y los representantes acreditados pueden dar asesoría legal migratoria. Tenga cuidado con los \"notarios\".",
          },
        ],
      },
    ],
    links: [L.newsroom, L.policyManual, L.visaBulletin, L.legalHelp],
  },
  {
    slug: "faq",
    icon: { ios: "questionmark.circle", md: "help", tint: "pink" },
    title: { en: "FAQ", es: "Preguntas frecuentes" },
    summary: { en: "Clear answers to common questions about USCIS cases.", es: "Respuestas claras a preguntas comunes sobre casos de USCIS." },
    intro: {
      en: "Short answers to what people ask most. For advice about your own case, talk to a licensed immigration lawyer or an accredited representative.",
      es: "Respuestas breves a lo que más se pregunta. Para asesoría sobre su caso, hable con un abogado de inmigración con licencia o con un representante acreditado.",
    },
    sections: [],
    faq: [
      {
        q: { en: "Where do I find my receipt number?", es: "¿Dónde encuentro mi número de recibo?" },
        a: {
          en: "On the receipt notice USCIS sent after you filed (Form I-797C), near the top. It's 3 letters and 10 digits, like EAC9999103402. If you filed online, it's also in your USCIS online account. In the CasePingo app you can scan the notice.",
          es: "En el aviso de recibo que USCIS envió después de presentar (Formulario I-797C), cerca de la parte superior. Son 3 letras y 10 dígitos, como EAC9999103402. Si presentó por internet, también aparece en su cuenta en línea de USCIS. En la app de CasePingo puede escanear el aviso.",
        },
        links: [L.account],
      },
      {
        q: { en: "What does my case status mean?", es: "¿Qué significa el estado de mi caso?" },
        a: {
          en: "Look it up in CasePingo's status library: what it means, what usually happens next and what you can do. USCIS's own wording is always the official one.",
          es: "Búsquelo en la biblioteca de estados de CasePingo: qué significa, qué suele pasar después y qué puede hacer. La redacción de USCIS siempre es la oficial.",
        },
        links: [L.statusLibrary],
      },
      {
        q: { en: "How long will my case take?", es: "¿Cuánto tardará mi caso?" },
        a: {
          en: "It depends on the form, the category and the office. USCIS publishes recent processing times; our guide explains how to read them.",
          es: "Depende del formulario, la categoría y la oficina. USCIS publica los tiempos de procesamiento recientes; nuestra guía explica cómo leerlos.",
        },
        links: [L.processingGuide, L.processingTimes],
      },
      {
        q: { en: "My case hasn't changed in months. What can I do?", es: "Mi caso no ha cambiado en meses. ¿Qué puedo hacer?" },
        a: {
          en: "Check USCIS's processing times for your form and office. If your case is outside normal processing time, you can send USCIS a case inquiry online or call the USCIS Contact Center. A lawyer can also help.",
          es: "Revise los tiempos de procesamiento de USCIS para su formulario y oficina. Si su caso está fuera del tiempo normal, puede enviar una consulta a USCIS por internet o llamar al Centro de Contacto de USCIS. Un abogado también puede ayudar.",
        },
        links: [L.processingTimes, L.contactCenter],
      },
      {
        q: { en: "I moved. How do I tell USCIS?", es: "Me mudé. ¿Cómo se lo digo a USCIS?" },
        a: {
          en: "Update your address with USCIS online, ideally right away. Most people who aren't U.S. citizens must report a new address within 10 days of moving.",
          es: "Actualice su dirección con USCIS por internet, idealmente de inmediato. La mayoría de las personas que no son ciudadanas de EE. UU. deben informar su nueva dirección dentro de los 10 días siguientes a la mudanza.",
        },
        links: [L.addressChange],
      },
      {
        q: { en: "What is a Request for Evidence (RFE)?", es: "¿Qué es una Solicitud de Evidencia (RFE)?" },
        a: {
          en: "A notice asking for more documents or information before USCIS decides. Send everything it asks for by the deadline on the notice. Many people get help from a lawyer.",
          es: "Un aviso que pide más documentos o información antes de que USCIS decida. Envíe todo lo que pide antes de la fecha límite del aviso. Muchas personas buscan ayuda de un abogado.",
        },
      },
      {
        q: { en: "What is a priority date?", es: "¿Qué es una fecha de prioridad?" },
        a: {
          en: "Your place in line in a green card category. It's on your petition's receipt or approval notice. The monthly Visa Bulletin shows which priority dates can move forward.",
          es: "Su lugar en la fila de una categoría de green card. Aparece en el aviso de recibo o de aprobación de su petición. El Boletín de Visas mensual muestra qué fechas de prioridad pueden avanzar.",
        },
        links: [L.visaBulletin],
      },
      {
        q: { en: "Can I track a family member's case?", es: "¿Puedo seguir el caso de un familiar?" },
        a: {
          en: "Yes, with their permission. When you add a case, CasePingo asks you to confirm it's yours or that the person allowed you to track it.",
          es: "Sí, con su permiso. Al agregar un caso, CasePingo le pide confirmar que es suyo o que la persona le permitió seguirlo.",
        },
      },
      {
        q: { en: "Is CasePingo part of USCIS?", es: "¿CasePingo es parte de USCIS?" },
        a: {
          en: "No. CasePingo is an independent service. Case status comes from USCIS, and the official source is USCIS Case Status Online.",
          es: "No. CasePingo es un servicio independiente. El estado de los casos viene de USCIS, y la fuente oficial es el estado de casos en línea de USCIS.",
        },
        links: [L.caseStatus],
      },
      {
        q: { en: "Does CasePingo give legal advice?", es: "¿CasePingo da asesoría legal?" },
        a: {
          en: "No. CasePingo explains statuses in plain language. For advice about your case, talk to a licensed immigration lawyer or an accredited representative.",
          es: "No. CasePingo explica los estados con palabras sencillas. Para asesoría sobre su caso, hable con un abogado de inmigración con licencia o con un representante acreditado.",
        },
        links: [L.legalHelp],
      },
    ],
    links: [],
  },
  {
    slug: "how-casepingo-helps",
    icon: { ios: "sparkles", md: "auto_awesome", tint: "purple" },
    title: { en: "How CasePingo helps", es: "Cómo ayuda CasePingo" },
    summary: { en: "What CasePingo does for you and your family.", es: "Lo que CasePingo hace por usted y su familia." },
    intro: {
      en: "CasePingo keeps your USCIS cases in one place and tells you when something changes.",
      es: "CasePingo reúne sus casos de USCIS en un solo lugar y le avisa cuando algo cambia.",
    },
    sections: [
      {
        heading: { en: "For you and your family", es: "Para usted y su familia" },
        bullets: [
          {
            en: "Status checks with USCIS: check yourself on the Free plan, or get automatic checks twice a day with Premium.",
            es: "Consultas de estado con USCIS: revise usted mismo con el plan Free, o reciba consultas automáticas dos veces al día con Premium.",
          },
          { en: "Alerts by email and phone notification when a status changes (Premium).", es: "Alertas por correo y notificación en el teléfono cuando cambia un estado (Premium)." },
          { en: "Plain-language explanations of each status, in English and Spanish.", es: "Explicaciones sencillas de cada estado, en inglés y español." },
          { en: "A timeline of every change, plus the history USCIS reports.", es: "Una línea de tiempo de cada cambio, más el historial que reporta USCIS." },
          { en: "Up to 10 family cases in one place (Premium).", es: "Hasta 10 casos de la familia en un solo lugar (Premium)." },
          {
            en: "Civics test practice with USCIS's official questions, with the real pass and fail rules.",
            es: "Práctica del examen de cívica con las preguntas oficiales de USCIS y las reglas reales para aprobar.",
          },
        ],
      },
      {
        heading: { en: "For law firms", es: "Para despachos de abogados" },
        bullets: [
          {
            en: "A shared workspace for the team, clients and cases, with CSV import and an activity log, on the website.",
            es: "Un espacio compartido para el equipo, los clientes y los casos, con importación CSV y registro de actividad, en el sitio web.",
          },
        ],
      },
      {
        heading: { en: "Your privacy", es: "Su privacidad" },
        bullets: [
          { en: "No ads and no tracking. Receipt numbers are encrypted.", es: "Sin anuncios ni rastreo. Los números de recibo están cifrados." },
          { en: "Delete your account and data at any time in Settings.", es: "Elimine su cuenta y sus datos cuando quiera en Ajustes." },
        ],
      },
    ],
    links: [
      { label: { en: "How it works", es: "Cómo funciona" }, url: "/how-it-works", webOnly: true },
      { label: { en: "Plans and prices", es: "Planes y precios" }, url: "/pricing", webOnly: true },
    ],
  },
  {
    slug: "contact",
    icon: { ios: "bubble.left", md: "chat_bubble", tint: "teal" },
    title: { en: "Contact us", es: "Contáctenos" },
    summary: { en: "Questions about CasePingo? Write to us.", es: "¿Preguntas sobre CasePingo? Escríbanos." },
    intro: { en: "Write to us about your account, the app or the website.", es: "Escríbanos sobre su cuenta, la app o el sitio web." },
    sections: [
      {
        heading: { en: "Before you write", es: "Antes de escribir" },
        bullets: [
          { en: "We can't see or change your case at USCIS, and we can't give legal advice.", es: "No podemos ver ni cambiar su caso en USCIS, ni dar asesoría legal." },
          { en: "For questions about the case itself, contact USCIS.", es: "Para preguntas sobre el caso en sí, contacte a USCIS." },
          { en: "The FAQ may already have your answer.", es: "Puede que las preguntas frecuentes ya tengan su respuesta." },
        ],
      },
    ],
    links: [L.faq, L.contactCenter],
  },
];

/** Official tools, one tap away (USCIS and CBP sites). Shown as a list on the resources hub. */
export type OfficialTool = { key: string; icon: { ios: string; md: string }; title: Text; summary: Text; url: string };
export const OFFICIAL_TOOLS: OfficialTool[] = [
  {
    key: "e-request",
    icon: { ios: "envelope.badge", md: "contact_mail" },
    title: { en: "e-Request", es: "e-Request (solicitud en línea)" },
    summary: {
      en: "Ask USCIS about a case outside normal processing times, a notice you never got, or a typo on a notice.",
      es: "Consulte a USCIS por un caso fuera del tiempo normal, un aviso que no recibió o un error en un aviso.",
    },
    url: "https://egov.uscis.gov/e-request/Intro.do",
  },
  {
    key: "processing-times",
    icon: { ios: "clock", md: "schedule" },
    title: { en: "Official processing times", es: "Tiempos oficiales de procesamiento" },
    summary: { en: "USCIS's own estimates for your form and office.", es: "Las estimaciones de USCIS para su formulario y oficina." },
    url: "https://egov.uscis.gov/processing-times/",
  },
  {
    key: "i94",
    icon: { ios: "airplane", md: "flight" },
    title: { en: "I-94 travel record", es: "Registro de viaje I-94" },
    summary: { en: "Get your most recent I-94 arrival and departure record from CBP.", es: "Obtenga su registro I-94 de entrada y salida más reciente de CBP." },
    url: "https://i94.cbp.dhs.gov/",
  },
  {
    key: "fee-calculator",
    icon: { ios: "dollarsign.circle", md: "payments" },
    title: { en: "Filing fee calculator", es: "Calculadora de tarifas" },
    summary: { en: "Work out the USCIS filing fee for your form.", es: "Calcule la tarifa de USCIS para su formulario." },
    url: "https://www.uscis.gov/feecalculator",
  },
  {
    key: "address-change",
    icon: { ios: "house", md: "home" },
    title: { en: "Change of address", es: "Cambio de dirección" },
    summary: { en: "Moved? Tell USCIS so your notices and cards reach you.", es: "¿Se mudó? Avísele a USCIS para que sus avisos y tarjetas le lleguen." },
    url: "https://www.uscis.gov/addresschange",
  },
];

/** The status library is its own section of the site; the hub shows it first. */
export const STATUS_LIBRARY_CARD = {
  icon: { ios: "book", md: "menu_book", tint: "blue" } satisfies ResourceIcon,
  title: { en: "USCIS status library", es: "Biblioteca de estados de USCIS" },
  summary: { en: "What each case status means and what usually comes next.", es: "Qué significa cada estado y qué suele pasar después." },
  path: "/status-guide",
};

const BY_SLUG = new Map(RESOURCES.map((r) => [r.slug, r]));
export const resourceBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;
export const resourcePath = (slug: string) => `/resources/${slug}`;

/** The support email, once NEXT_PUBLIC_CONTACT_EMAIL is set (otherwise null). */
export function contactEmail(env: Record<string, string | undefined> = process.env): string | null {
  const e = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
