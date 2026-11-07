import nodemailer from "nodemailer";
import type { EmailDriver } from "./types";

// Provider-agnostic SMTP (Resend, Postmark, SES…), as in Scanvio.
// Selected whenever SMTP_HOST is set.
export const smtpDriver: EmailDriver = {
  name: "smtp",
  async send({ to, subject, body, fromName, replyTo }) {
    // `||` so empty template values fall back to defaults.
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
    const from = process.env.EMAIL_FROM || "CasePingo <no-reply@casepingo.com>";
    // Keep CasePingo's sending address (it's the verified one); only the display name changes.
    const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
    await transport.sendMail({
      from: fromName ? { name: fromName, address } : from,
      to,
      subject,
      text: body,
      ...(replyTo ? { replyTo } : {}),
    });
  },
};
