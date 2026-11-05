import type { EmailDriver } from "./types";

// Development default: prints instead of sending (no SMTP_HOST set).
export const consoleDriver: EmailDriver = {
  name: "console",
  async send({ to, subject, body }) {
    console.log(`[email:console] to=${to} subject=${JSON.stringify(subject)}\n${body}\n`);
  },
};
