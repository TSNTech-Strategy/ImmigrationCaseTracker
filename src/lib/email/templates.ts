import type { EmailMessage } from "./types";

type StatusChange = {
  to: string;
  name: string | null;
  locale: string;
  caseLabel: string; // nickname or masked receipt — never the full receipt
  receiptMasked: string;
  formType: string | null;
  statusTitleEn: string | null;
  statusTitleEs: string | null;
  caseUrl: string;
  settingsUrl: string;
};

/** Plain-text alert. Contains the masked receipt only, never the full number. */
export function statusChangeEmail(p: StatusChange): EmailMessage {
  const es = p.locale === "es";
  const status = (es ? p.statusTitleEs : p.statusTitleEn) ?? p.statusTitleEn ?? p.statusTitleEs ?? "Status updated";
  const form = p.formType ? ` (${p.formType})` : "";
  if (es) {
    return {
      to: p.to,
      subject: `Actualización de su caso: ${status}`,
      body: [
        `Hola${p.name ? ` ${p.name}` : ""}:`,
        "",
        `Vimos un cambio en el estado de su caso ${p.caseLabel}${form}, recibo ${p.receiptMasked}.`,
        "",
        `Estado actual: ${status}`,
        "",
        `Ver detalles: ${p.caseUrl}`,
        "",
        "USCIS es la fuente oficial del estado de su caso. ImmigrationCaseTracker es un servicio independiente, no está afiliado a USCIS ni al DHS y no ofrece asesoría legal.",
        "",
        `Para dejar de recibir estos correos, cambie sus alertas en ${p.settingsUrl}`,
      ].join("\n"),
    };
  }
  return {
    to: p.to,
    subject: `Case update: ${status}`,
    body: [
      `Hi${p.name ? ` ${p.name}` : ""},`,
      "",
      `We saw a status change on your case ${p.caseLabel}${form}, receipt ${p.receiptMasked}.`,
      "",
      `Current status: ${status}`,
      "",
      `See details: ${p.caseUrl}`,
      "",
      "USCIS is the authoritative source for your case status. ImmigrationCaseTracker is an independent service, not affiliated with USCIS or DHS, and does not provide legal advice.",
      "",
      `To stop these emails, change your alerts at ${p.settingsUrl}`,
    ].join("\n"),
  };
}
