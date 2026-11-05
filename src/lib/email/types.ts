export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text body. */
  body: string;
}

export interface EmailDriver {
  readonly name: "console" | "smtp";
  send(message: EmailMessage): Promise<void>;
}
