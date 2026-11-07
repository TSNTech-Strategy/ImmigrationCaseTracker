export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text body. */
  body: string;
  /** Optional HTML version (same words as `body`), e.g. with the law firm's logo on top. */
  html?: string;
  /** Shown as the sender's name (the address stays CasePingo's), e.g. "Lopez Law via CasePingo". */
  fromName?: string;
  /** Where replies go, e.g. the law firm's own address. */
  replyTo?: string;
}

export interface EmailDriver {
  readonly name: "console" | "smtp";
  send(message: EmailMessage): Promise<void>;
}
