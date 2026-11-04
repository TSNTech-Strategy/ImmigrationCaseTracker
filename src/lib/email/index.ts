import { consoleDriver } from "./console";
import { smtpDriver } from "./smtp";
import type { EmailDriver } from "./types";

export type { EmailDriver, EmailMessage } from "./types";

export function getEmailDriver(): EmailDriver {
  return process.env.SMTP_HOST ? smtpDriver : consoleDriver;
}
