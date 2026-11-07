import type { EmailDriver } from "./types";

// Development default: prints instead of sending (no SMTP_HOST set).
export const consoleDriver: EmailDriver = {
  name: "console",
  async send({ to, subject, body, fromName, replyTo }) {
    console.log(`[email:console] to=${to}${fromName ? ` from=${JSON.stringify(fromName)}` : ""}${replyTo ? ` replyTo=${replyTo}` : ""} subject=${JSON.stringify(subject)}\n${body}\n`);
  },
};
