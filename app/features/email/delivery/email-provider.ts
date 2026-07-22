export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailSendResult = {
  messageId: string | null;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class EmailProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailProviderError";
    this.retryable = retryable;
  }
}

export type EmailSenderConfig = {
  address: string;
  name?: string;
  replyTo?: string;
};

export function getEmailSenderConfig(): EmailSenderConfig {
  const address =
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim();
  if (!address) {
    throw new EmailProviderError(
      "Email sender is not configured. Set EMAIL_FROM_ADDRESS.",
      false,
    );
  }

  return {
    address,
    name:
      process.env.EMAIL_FROM_NAME?.trim() ||
      process.env.SENDGRID_FROM_NAME?.trim() ||
      undefined,
    replyTo:
      process.env.EMAIL_REPLY_TO?.trim() ||
      process.env.SENDGRID_REPLY_TO?.trim() ||
      undefined,
  };
}

export function htmlToPlainText(html: string) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
