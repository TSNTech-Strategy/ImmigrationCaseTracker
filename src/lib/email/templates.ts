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
        "USCIS es la fuente oficial del estado de su caso. CasePingo es un servicio independiente, no está afiliado a USCIS ni al DHS y no ofrece asesoría legal.",
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
      "USCIS is the authoritative source for your case status. CasePingo is an independent service, not affiliated with USCIS or DHS, and does not provide legal advice.",
      "",
      `To stop these emails, change your alerts at ${p.settingsUrl}`,
    ].join("\n"),
  };
}

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", STAFF: "Staff" } as const;

/** Invitation to join a firm workspace. The link carries a single-use token. */
export function firmInviteEmail(p: {
  to: string;
  firmName: string;
  inviterName: string;
  role: keyof typeof ROLE_LABEL;
  acceptUrl: string;
  expiresAt: Date;
}): EmailMessage {
  const until = p.expiresAt.toUTCString().slice(0, 16);
  return {
    to: p.to,
    subject: `${p.inviterName} invited you to ${p.firmName} on CasePingo`,
    body: [
      `${p.inviterName} invited you to join ${p.firmName} on CasePingo Pro as ${ROLE_LABEL[p.role]}.`,
      "",
      `Accept the invitation: ${p.acceptUrl}`,
      "",
      `This link works once and expires on ${until}. Sign in (or create an account) with ${p.to} to accept.`,
      "If you weren't expecting this, you can ignore this email.",
      "",
      "CasePingo is an independent service, not affiliated with USCIS or DHS, and does not provide legal advice.",
    ].join("\n"),
  };
}
