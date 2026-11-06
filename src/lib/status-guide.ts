import { statusCategory, type StatusCategory } from "./status-category";

/**
 * Plain-language explanations of common USCIS case statuses: what the status
 * means, what usually happens next, and what the person can do.
 *
 * - General information only, never legal advice. USCIS's own wording is
 *   always shown next to it, and the official description wins.
 * - Matching uses USCIS's English title (exact first, then a pattern).
 * - Shown in the web app, sent to the mobile app by the API (so wording can
 *   improve without an app release), and published at /status-guide.
 */

type Text = { en: string; es: string };

export type StatusGuideEntry = {
  slug: string;
  /** USCIS's English wording (the most common variant). */
  title: string;
  /** Page heading when one entry covers several wordings. Defaults to `title`. */
  heading?: string;
  /** Other exact USCIS wordings with the same meaning. */
  aliases?: string[];
  /** Fallback match for wording variants. */
  pattern?: RegExp;
  meaning: Text;
  next: Text;
  todo?: Text;
};

export const STATUS_GUIDE: StatusGuideEntry[] = [
  {
    slug: "case-was-received",
    title: "Case Was Received",
    aliases: ["Case Was Received and A Receipt Notice Was Sent", "Case Was Received And A Receipt Notice Was Emailed"],
    pattern: /^case was received/i,
    meaning: {
      en: "USCIS has your application or petition and gave it this receipt number. It hasn't been decided yet.",
      es: "USCIS tiene su solicitud o petición y le asignó este número de recibo. Todavía no se ha tomado una decisión.",
    },
    next: {
      en: "USCIS checks the filing and, for many forms, mails a biometrics appointment notice. It's normal for this status to stay the same for weeks or even months.",
      es: "USCIS revisa la solicitud y, para muchos formularios, envía por correo un aviso de cita de datos biométricos. Es normal que este estado no cambie durante semanas o incluso meses.",
    },
    todo: {
      en: "Keep your receipt notice (Form I-797C) somewhere safe, and update your address with USCIS if you move.",
      es: "Guarde su aviso de recibo (Formulario I-797C) en un lugar seguro y actualice su dirección con USCIS si se muda.",
    },
  },
  {
    slug: "fingerprint-fee-was-received",
    title: "Fingerprint Fee Was Received",
    meaning: {
      en: "USCIS received the biometrics (fingerprint) fee for your case.",
      es: "USCIS recibió el pago de datos biométricos (huellas dactilares) de su caso.",
    },
    next: {
      en: "If your form needs biometrics, an appointment notice usually arrives by mail. Processing continues in the meantime.",
      es: "Si su formulario requiere datos biométricos, normalmente recibirá por correo un aviso de cita. Mientras tanto, el trámite continúa.",
    },
  },
  {
    slug: "biometrics-appointment-was-scheduled",
    title: "Biometrics Appointment Was Scheduled",
    meaning: {
      en: "USCIS scheduled an appointment to take your fingerprints, photo and signature at an Application Support Center.",
      es: "USCIS programó una cita para tomar sus huellas dactilares, foto y firma en un Centro de Asistencia para Solicitudes (ASC).",
    },
    next: {
      en: "Your appointment notice (Form I-797C) has the date, time and address. After the appointment, the status usually changes to show your fingerprints were taken.",
      es: "Su aviso de cita (Formulario I-797C) indica la fecha, la hora y la dirección. Después de la cita, el estado normalmente cambia para indicar que se tomaron sus huellas.",
    },
    todo: {
      en: "Bring the appointment notice and a photo ID. If you can't go, follow the rescheduling instructions on the notice before the appointment date.",
      es: "Lleve el aviso de cita y una identificación con foto. Si no puede asistir, siga las instrucciones del aviso para reprogramarla antes de la fecha de la cita.",
    },
  },
  {
    slug: "fingerprints-were-taken",
    title: "Case Was Updated To Show Fingerprints Were Taken",
    pattern: /fingerprints were taken/i,
    meaning: {
      en: "Your biometrics appointment is done and USCIS has your fingerprints.",
      es: "Su cita de datos biométricos se completó y USCIS ya tiene sus huellas dactilares.",
    },
    next: {
      en: "USCIS uses them for background checks and keeps reviewing your case. There's nothing you need to do right now.",
      es: "USCIS las usa para las verificaciones de antecedentes y sigue revisando su caso. Por ahora no tiene que hacer nada.",
    },
  },
  {
    slug: "case-is-being-actively-reviewed",
    title: "Case Is Being Actively Reviewed By USCIS",
    pattern: /actively reviewed/i,
    meaning: {
      en: "Your case is in an active stage of review. An officer may be working on it, but this status doesn't mean a decision is about to happen.",
      es: "Su caso está en una etapa activa de revisión. Es posible que un oficial lo esté trabajando, pero este estado no significa que la decisión sea inminente.",
    },
    next: {
      en: "The review can end in an approval, a request for more evidence, or an interview notice. This status can stay the same for a long time.",
      es: "La revisión puede terminar en una aprobación, una solicitud de más evidencia o un aviso de entrevista. Este estado puede durar mucho tiempo.",
    },
    todo: {
      en: "Make sure USCIS has your current mailing address so you don't miss a letter.",
      es: "Asegúrese de que USCIS tenga su dirección postal actual para no perder ninguna carta.",
    },
  },
  {
    slug: "request-for-evidence-was-sent",
    title: "Request for Additional Evidence Was Sent",
    aliases: ["Request for Evidence Was Sent"],
    pattern: /request for (additional )?evidence was (sent|mailed)/i,
    meaning: {
      en: "USCIS needs more documents or information before it can decide your case. This is common and isn't a denial.",
      es: "USCIS necesita más documentos o información antes de decidir su caso. Es algo común y no significa una negación.",
    },
    next: {
      en: "The letter (a Request for Evidence, or RFE) lists exactly what USCIS needs and the deadline. The case waits until USCIS receives your response or the deadline passes.",
      es: "La carta (Solicitud de Evidencia, o RFE) indica exactamente qué necesita USCIS y la fecha límite. El caso queda en espera hasta que USCIS reciba su respuesta o se venza el plazo.",
    },
    todo: {
      en: "Read the letter carefully and send everything it asks for before the deadline. Many people get help from an immigration attorney for this step.",
      es: "Lea la carta con atención y envíe todo lo que pide antes de la fecha límite. Muchas personas buscan la ayuda de un abogado de inmigración en este paso.",
    },
  },
  {
    slug: "request-for-initial-evidence-was-sent",
    title: "Request for Initial Evidence Was Sent",
    pattern: /request for initial evidence/i,
    meaning: {
      en: "Something required was missing from your filing, such as a document, photo or signature, and USCIS asked for it.",
      es: "Faltaba algo obligatorio en su solicitud, como un documento, una foto o una firma, y USCIS lo solicitó.",
    },
    next: {
      en: "The letter lists what's missing and the deadline. USCIS continues once it receives your response.",
      es: "La carta indica lo que falta y la fecha límite. USCIS continúa cuando recibe su respuesta.",
    },
    todo: {
      en: "Send exactly what the letter asks for before the deadline, following its instructions for how to send it.",
      es: "Envíe exactamente lo que pide la carta antes de la fecha límite y siga sus instrucciones de envío.",
    },
  },
  {
    slug: "response-to-request-for-evidence-was-received",
    title: "Response To USCIS' Request For Evidence Was Received",
    pattern: /response to uscis.? request for evidence was received/i,
    meaning: {
      en: "USCIS received your response to its request for evidence.",
      es: "USCIS recibió su respuesta a la solicitud de evidencia.",
    },
    next: {
      en: "USCIS reviews what you sent and then makes a decision or asks for more. There's nothing more to send unless USCIS asks.",
      es: "USCIS revisa lo que usted envió y luego toma una decisión o pide más información. No tiene que enviar nada más a menos que USCIS lo pida.",
    },
  },
  {
    slug: "interview-was-scheduled",
    title: "Interview Was Scheduled",
    meaning: {
      en: "USCIS scheduled an interview for your case at a USCIS office.",
      es: "USCIS programó una entrevista para su caso en una oficina de USCIS.",
    },
    next: {
      en: "Your interview notice has the date, time, location and what to bring. After the interview, the officer either decides the case or reviews it further.",
      es: "Su aviso de entrevista indica la fecha, la hora, el lugar y qué debe llevar. Después de la entrevista, el oficial decide el caso o lo revisa más a fondo.",
    },
    todo: {
      en: "Read the notice early and gather the documents it lists. If you can't attend, follow the rescheduling instructions on the notice.",
      es: "Lea el aviso con anticipación y reúna los documentos que indica. Si no puede asistir, siga las instrucciones del aviso para reprogramar.",
    },
  },
  {
    slug: "interview-was-completed",
    title: "Interview Was Completed And My Case Must Be Reviewed",
    pattern: /interview was completed/i,
    meaning: {
      en: "Your interview took place, and the officer needs more time to review the case before deciding.",
      es: "Su entrevista se realizó y el oficial necesita más tiempo para revisar el caso antes de decidir.",
    },
    next: {
      en: "USCIS may approve the case, ask for more evidence, or send a decision by mail. How long this takes varies.",
      es: "USCIS puede aprobar el caso, pedir más evidencia o enviar la decisión por correo. El tiempo que tarda varía.",
    },
  },
  {
    slug: "interview-was-cancelled",
    title: "Interview Cancelled And Notice Ordered",
    pattern: /interview (was )?cancel/i,
    meaning: {
      en: "USCIS cancelled the interview that was scheduled for your case and is sending you a notice.",
      es: "USCIS canceló la entrevista que estaba programada para su caso y le enviará un aviso.",
    },
    next: {
      en: "The notice explains what happens next, for example whether a new interview will be scheduled.",
      es: "El aviso explica lo que sigue, por ejemplo si se programará una nueva entrevista.",
    },
    todo: {
      en: "Don't go to the cancelled appointment unless USCIS tells you to. Watch your mail for the notice.",
      es: "No acuda a la cita cancelada a menos que USCIS se lo indique. Esté atento al aviso en su correo.",
    },
  },
  {
    slug: "ready-to-be-scheduled-for-an-interview",
    title: "Ready to Be Scheduled for An Interview",
    pattern: /ready to be scheduled for an interview/i,
    meaning: {
      en: "Your case is ready for an interview, and USCIS is waiting for an open appointment at the office handling it.",
      es: "Su caso está listo para una entrevista y USCIS espera un horario disponible en la oficina que lo tramita.",
    },
    next: {
      en: "You'll get an interview notice by mail with the date, time and location. The wait depends on the office's workload.",
      es: "Recibirá por correo un aviso con la fecha, la hora y el lugar de la entrevista. La espera depende de la carga de trabajo de la oficina.",
    },
  },
  {
    slug: "request-to-reschedule-was-received",
    title: "Request to Reschedule My Appointment Was Received",
    pattern: /request to reschedule/i,
    meaning: {
      en: "USCIS received your request to move an appointment, such as biometrics or an interview.",
      es: "USCIS recibió su solicitud para cambiar una cita, como la de datos biométricos o una entrevista.",
    },
    next: {
      en: "A new appointment notice is mailed to you.",
      es: "Se le enviará por correo un nuevo aviso de cita.",
    },
  },
  {
    slug: "case-was-transferred",
    title: "Case Was Transferred And A New Office Has Jurisdiction",
    pattern: /case was transferred/i,
    meaning: {
      en: "USCIS moved your case to another office. This is routine, for example to hold an interview or to balance workloads.",
      es: "USCIS trasladó su caso a otra oficina. Es algo rutinario, por ejemplo para realizar una entrevista o equilibrar la carga de trabajo.",
    },
    next: {
      en: "The new office continues the case, and its processing times now apply.",
      es: "La nueva oficina continúa con el caso y ahora aplican sus tiempos de procesamiento.",
    },
    todo: {
      en: "You may get a transfer notice in the mail that names the new office.",
      es: "Es posible que reciba por correo un aviso de traslado con el nombre de la nueva oficina.",
    },
  },
  {
    slug: "expedite-request-received",
    title: "Expedite Request Received",
    pattern: /expedite request (was )?received/i,
    meaning: {
      en: "USCIS received your request to speed up (expedite) your case.",
      es: "USCIS recibió su solicitud para acelerar su caso.",
    },
    next: {
      en: "USCIS checks the request against its expedite criteria and lets you know. Your case keeps moving either way.",
      es: "USCIS evalúa la solicitud según sus criterios de aceleración y le informará. Su caso sigue su curso de todos modos.",
    },
  },
  {
    slug: "expedite-request-denied",
    title: "Expedite Request Denied",
    pattern: /expedite request (was )?denied/i,
    meaning: {
      en: "USCIS decided not to speed up your case. Only the expedite request was denied, not your case.",
      es: "USCIS decidió no acelerar su caso. Solo se negó la solicitud de aceleración, no su caso.",
    },
    next: {
      en: "Your case continues in normal processing order.",
      es: "Su caso continúa en el orden normal de procesamiento.",
    },
    todo: {
      en: "If your situation changes, for example a new urgent reason, you can ask again with new evidence.",
      es: "Si su situación cambia, por ejemplo por un nuevo motivo urgente, puede volver a solicitarlo con nueva evidencia.",
    },
  },
  {
    slug: "fees-were-waived",
    title: "Fees Were Waived",
    pattern: /fees? (was|were) waived/i,
    meaning: {
      en: "USCIS approved your fee waiver request, so you don't pay the filing fee for this case.",
      es: "USCIS aprobó su solicitud de exención de tarifas, así que no paga la tarifa de presentación de este caso.",
    },
    next: {
      en: "Your case continues in normal processing.",
      es: "Su caso continúa con el procesamiento normal.",
    },
  },
  {
    slug: "information-was-updated",
    title: "Name Was Updated",
    heading: "Name or Date of Birth Was Updated",
    aliases: ["Date of Birth Was Updated"],
    meaning: {
      en: "USCIS updated personal information in your case record, such as your name or date of birth.",
      es: "USCIS actualizó información personal en el registro de su caso, como su nombre o fecha de nacimiento.",
    },
    next: {
      en: "Review continues as before.",
      es: "La revisión continúa como antes.",
    },
    todo: {
      en: "If you didn't expect the change or it looks wrong, contact USCIS.",
      es: "Si no esperaba el cambio o parece incorrecto, comuníquese con USCIS.",
    },
  },
  {
    slug: "case-was-reopened",
    title: "Case Was Reopened",
    pattern: /reopened/i,
    meaning: {
      en: "USCIS reopened your case, for example after a motion or on its own initiative.",
      es: "USCIS reabrió su caso, por ejemplo después de una moción o por iniciativa propia.",
    },
    next: {
      en: "USCIS reviews the case again and sends a new decision or request.",
      es: "USCIS vuelve a revisar el caso y enviará una nueva decisión o solicitud.",
    },
  },
  {
    slug: "notice-explaining-uscis-actions-was-mailed",
    title: "Notice Explaining USCIS Actions Was Mailed",
    pattern: /notice explaining uscis actions/i,
    meaning: {
      en: "USCIS mailed you a letter about an action it took on your case. The status itself doesn't say what the action was.",
      es: "USCIS le envió por correo una carta sobre una acción que tomó en su caso. El estado en sí no indica cuál fue la acción.",
    },
    next: {
      en: "What happens next depends on the letter. It may ask you to do something by a deadline.",
      es: "Lo que sigue depende de la carta. Es posible que le pida hacer algo antes de una fecha límite.",
    },
    todo: {
      en: "Watch your mail and read the letter as soon as it arrives. If it's unclear, consider asking an immigration attorney.",
      es: "Esté atento a su correo y lea la carta en cuanto llegue. Si no está clara, considere consultar con un abogado de inmigración.",
    },
  },
  {
    slug: "case-was-approved",
    title: "Case Was Approved",
    aliases: ["Case Was Approved And My Decision Was Emailed", "Approval Notice Was Sent"],
    pattern: /^case was approved/i,
    meaning: {
      en: "USCIS approved your application or petition.",
      es: "USCIS aprobó su solicitud o petición.",
    },
    next: {
      en: "An approval notice is sent to you. What comes next depends on the form: a green card or work permit is produced and mailed; a family petition for someone abroad goes to the Department of State; for citizenship, an oath ceremony is scheduled.",
      es: "Se le enviará un aviso de aprobación. Lo que sigue depende del formulario: una tarjeta de residente o un permiso de trabajo se produce y se envía por correo; una petición familiar para alguien en el extranjero pasa al Departamento de Estado; para la ciudadanía, se programa una ceremonia de juramentación.",
    },
    todo: {
      en: "Check that USCIS has your current mailing address so your notice and card reach you.",
      es: "Verifique que USCIS tenga su dirección postal actual para que el aviso y la tarjeta le lleguen.",
    },
  },
  {
    slug: "approval-was-reaffirmed",
    title: "Case Approval Was Reaffirmed And Mailed Back To Department Of State",
    aliases: ["Case Approval Was Affirmed"],
    pattern: /approval was (re)?affirmed/i,
    meaning: {
      en: "USCIS reviewed the petition again, often after the Department of State sent it back, and confirmed the approval.",
      es: "USCIS volvió a revisar la petición, a menudo después de que el Departamento de Estado la devolviera, y confirmó la aprobación.",
    },
    next: {
      en: "The case goes back to the Department of State to continue the visa process.",
      es: "El caso vuelve al Departamento de Estado para continuar el trámite de la visa.",
    },
  },
  {
    slug: "new-card-is-being-produced",
    title: "New Card Is Being Produced",
    pattern: /card is being produced/i,
    meaning: {
      en: "Your case was approved and USCIS is making your card, such as a green card or work permit.",
      es: "Su caso fue aprobado y USCIS está produciendo su tarjeta, como la tarjeta de residente o el permiso de trabajo.",
    },
    next: {
      en: "The next update is usually that the card was mailed, often with a U.S. Postal Service tracking number.",
      es: "Normalmente la siguiente actualización es que la tarjeta fue enviada por correo, a menudo con un número de rastreo del Servicio Postal de EE. UU.",
    },
  },
  {
    slug: "card-was-mailed",
    title: "Card Was Mailed To Me",
    meaning: {
      en: "USCIS mailed your card to the address it has on file.",
      es: "USCIS envió su tarjeta por correo a la dirección que tiene registrada.",
    },
    next: {
      en: "The Postal Service delivers it to your mailing address. The status may update when it's picked up or delivered.",
      es: "El Servicio Postal la entrega en su dirección postal. El estado puede actualizarse cuando la recojan o la entreguen.",
    },
    todo: {
      en: "If the official description includes a tracking number, you can follow it on the USPS website.",
      es: "Si la descripción oficial incluye un número de rastreo, puede seguirlo en el sitio web de USPS.",
    },
  },
  {
    slug: "card-was-picked-up-by-usps",
    title: "Card Was Picked Up By The United States Postal Service",
    pattern: /picked up by the united states postal service/i,
    meaning: {
      en: "The U.S. Postal Service has your card and is delivering it.",
      es: "El Servicio Postal de EE. UU. tiene su tarjeta y la está entregando.",
    },
    next: {
      en: "The official description usually includes a tracking number you can use on the USPS website.",
      es: "La descripción oficial normalmente incluye un número de rastreo que puede usar en el sitio web de USPS.",
    },
  },
  {
    slug: "card-was-delivered",
    title: "Card Was Delivered To Me By The Post Office",
    pattern: /card was delivered/i,
    meaning: {
      en: "The Postal Service reports that your card was delivered.",
      es: "El Servicio Postal informa que su tarjeta fue entregada.",
    },
    next: {
      en: "This is usually the last status for a card.",
      es: "Normalmente este es el último estado de una tarjeta.",
    },
    todo: {
      en: "Check the card's details right away. If you didn't get it or something is wrong, contact USCIS soon, because there are time limits for reporting it.",
      es: "Revise los datos de la tarjeta de inmediato. Si no la recibió o hay un error, comuníquese pronto con USCIS, porque hay plazos para reportarlo.",
    },
  },
  {
    slug: "document-was-mailed",
    title: "Document Was Mailed To Me",
    pattern: /document was mailed/i,
    meaning: {
      en: "USCIS mailed you a document related to your case, such as an approval notice or a travel document.",
      es: "USCIS le envió por correo un documento relacionado con su caso, como un aviso de aprobación o un documento de viaje.",
    },
    next: {
      en: "It's delivered to your mailing address. The official description may say which document it is.",
      es: "Se entrega en su dirección postal. La descripción oficial puede indicar de qué documento se trata.",
    },
  },
  {
    slug: "case-was-sent-to-the-department-of-state",
    title: "Case Was Sent To The Department of State",
    pattern: /sent to the department of state/i,
    meaning: {
      en: "This usually follows an approved petition: USCIS sent the case to the Department of State's National Visa Center (NVC) to continue the visa process abroad.",
      es: "Esto suele ocurrir después de aprobar una petición: USCIS envió el caso al Centro Nacional de Visas (NVC) del Departamento de Estado para continuar el trámite de visa en el extranjero.",
    },
    next: {
      en: "The National Visa Center contacts the applicant with instructions for fees, forms and documents. A consular interview comes later.",
      es: "El Centro Nacional de Visas se comunica con el solicitante con instrucciones sobre tarifas, formularios y documentos. La entrevista consular viene después.",
    },
    todo: {
      en: "Watch for an email or letter from the National Visa Center.",
      es: "Esté atento a un correo electrónico o carta del Centro Nacional de Visas.",
    },
  },
  {
    slug: "oath-ceremony-was-scheduled",
    title: "Oath Ceremony Was Scheduled",
    aliases: ["Oath Ceremony Notice Was Mailed"],
    pattern: /oath ceremony/i,
    meaning: {
      en: "USCIS scheduled your naturalization oath ceremony, the final step to becoming a U.S. citizen.",
      es: "USCIS programó su ceremonia de juramentación de naturalización, el último paso para convertirse en ciudadano de EE. UU.",
    },
    next: {
      en: "Your ceremony notice (Form N-445) has the date, time and place. You become a citizen when you take the oath at the ceremony.",
      es: "Su aviso de ceremonia (Formulario N-445) indica la fecha, la hora y el lugar. Usted se convierte en ciudadano al prestar el juramento en la ceremonia.",
    },
    todo: {
      en: "Read the notice, answer its questions, and bring it with your green card to the ceremony.",
      es: "Lea el aviso, responda sus preguntas y llévelo a la ceremonia junto con su tarjeta de residente.",
    },
  },
  {
    slug: "mail-was-returned-to-uscis",
    title: "Card Was Returned To USCIS",
    heading: "Card or Notice Was Returned To USCIS",
    aliases: ["Notice Was Returned To USCIS Because The Post Office Could Not Deliver It", "Card Is Being Returned to USCIS by Post Office"],
    pattern: /returned to uscis/i,
    meaning: {
      en: "The Postal Service couldn't deliver your card or notice and sent it back to USCIS.",
      es: "El Servicio Postal no pudo entregar su tarjeta o aviso y lo devolvió a USCIS.",
    },
    next: {
      en: "USCIS needs a correct address before it can send it again.",
      es: "USCIS necesita una dirección correcta para poder enviarlo de nuevo.",
    },
    todo: {
      en: "Update your address with USCIS, then contact USCIS to ask for it to be sent again.",
      es: "Actualice su dirección con USCIS y luego comuníquese con USCIS para pedir que lo envíen de nuevo.",
    },
  },
  {
    slug: "case-was-denied",
    title: "Case Was Denied",
    pattern: /^case was denied/i,
    meaning: {
      en: "USCIS denied the application or petition.",
      es: "USCIS negó la solicitud o petición.",
    },
    next: {
      en: "The decision letter explains the reasons and whether you can appeal or ask USCIS to reconsider. Those options have short deadlines.",
      es: "La carta de decisión explica los motivos y si puede apelar o pedir a USCIS que reconsidere. Esas opciones tienen plazos cortos.",
    },
    todo: {
      en: "Read the decision letter carefully and consider talking to an immigration attorney as soon as possible.",
      es: "Lea la carta de decisión con atención y considere hablar con un abogado de inmigración lo antes posible.",
    },
  },
  {
    slug: "case-was-rejected",
    title: "Case Was Rejected Because It Was Improperly Filed",
    heading: "Case Was Rejected",
    aliases: ["Case Rejected Because I Sent An Incorrect Fee", "Case Was Rejected Because I Did Not Sign My Form"],
    pattern: /rejected/i,
    meaning: {
      en: "USCIS didn't accept the filing, usually because of a problem such as a missing signature, a wrong fee or a form version that's no longer accepted. A rejection isn't a decision on the case itself.",
      es: "USCIS no aceptó la solicitud, normalmente por un problema como una firma que falta, un pago incorrecto o una versión del formulario que ya no se acepta. Un rechazo no es una decisión sobre el caso en sí.",
    },
    next: {
      en: "USCIS returns the package with a notice explaining why. The case won't move forward under this receipt number.",
      es: "USCIS devuelve el paquete con un aviso que explica el motivo. El caso no avanzará con este número de recibo.",
    },
    todo: {
      en: "Fix the problem the notice describes and file again with the correct form, fee and signature.",
      es: "Corrija el problema que indica el aviso y vuelva a presentar la solicitud con el formulario, el pago y la firma correctos.",
    },
  },
  {
    slug: "withdrawal-acknowledgement-notice-was-sent",
    title: "Withdrawal Acknowledgement Notice Was Sent",
    pattern: /withdrawal acknowledg/i,
    meaning: {
      en: "USCIS confirmed that the application or petition was withdrawn.",
      es: "USCIS confirmó que la solicitud o petición fue retirada.",
    },
    next: {
      en: "The case is closed. Filing fees generally aren't refunded.",
      es: "El caso está cerrado. Por lo general, las tarifas de presentación no se reembolsan.",
    },
  },
  {
    slug: "case-closed-benefit-received-by-other-means",
    title: "Case Closed Benefit Received By Other Means",
    pattern: /benefit received by other means/i,
    meaning: {
      en: "USCIS closed this case because you already received the same benefit another way, for example through a different application.",
      es: "USCIS cerró este caso porque usted ya recibió el mismo beneficio por otra vía, por ejemplo mediante otra solicitud.",
    },
    next: {
      en: "Nothing more happens under this receipt number.",
      es: "No habrá más acciones con este número de recibo.",
    },
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[‘’`]/g, "'").replace(/\s+/g, " ").trim();

const BY_TITLE = new Map<string, StatusGuideEntry>();
for (const g of STATUS_GUIDE) for (const t of [g.title, ...(g.aliases ?? [])]) BY_TITLE.set(norm(t), g);
const BY_SLUG = new Map(STATUS_GUIDE.map((g) => [g.slug, g]));

/** The guide entry for a USCIS English status title, if we have one. */
export function findStatusGuide(titleEn: string | null | undefined): StatusGuideEntry | null {
  if (!titleEn || !titleEn.trim()) return null;
  return BY_TITLE.get(norm(titleEn)) ?? STATUS_GUIDE.find((g) => g.pattern?.test(titleEn)) ?? null;
}

export const statusGuideBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;
export const guideCategory = (g: StatusGuideEntry): StatusCategory => statusCategory(g.title);
export const guideHeading = (g: StatusGuideEntry) => g.heading ?? g.title;
export const guidePath = (g: StatusGuideEntry) => `/status-guide/${g.slug}`;

/** The guide in one language, for the API and the case pages. */
export function guideText(g: StatusGuideEntry, lang: "en" | "es") {
  return { meaning: g.meaning[lang], next: g.next[lang], todo: g.todo?.[lang] ?? null };
}
