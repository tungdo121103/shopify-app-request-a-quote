import nodemailer from "nodemailer";
import {
  EmailProviderError,
  getEmailSenderConfig,
  htmlToPlainText,
  type EmailProvider,
} from "~/features/email/delivery/email-provider";

function parsePort(value: string | undefined) {
  const port = Number(value ?? "1025");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailProviderError("SMTP_PORT must be a valid TCP port.", false);
  }
  return port;
}

function isTrue(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function createSmtpEmailProvider(): EmailProvider {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new EmailProviderError(
      "SMTP is not configured. Set SMTP_HOST and SMTP_PORT.",
      false,
    );
  }

  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if ((user && !password) || (!user && password)) {
    throw new EmailProviderError(
      "Set both SMTP_USER and SMTP_PASSWORD, or leave both empty.",
      false,
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parsePort(process.env.SMTP_PORT),
    secure: isTrue(process.env.SMTP_SECURE),
    ...(user && password ? { auth: { user, pass: password } } : {}),
  });

  return {
    async send(message) {
      const sender = getEmailSenderConfig();
      try {
        const result = await transporter.sendMail({
          from: { address: sender.address, name: sender.name ?? "" },
          to: message.to,
          replyTo: sender.replyTo,
          subject: message.subject,
          text: message.text ?? htmlToPlainText(message.html),
          html: message.html,
        });
        return { messageId: result.messageId || null };
      } catch (error) {
        const details = error as { code?: string; responseCode?: number };
        const permanent =
          details.code === "EAUTH" ||
          details.code === "EENVELOPE" ||
          (typeof details.responseCode === "number" && details.responseCode >= 500);
        throw new EmailProviderError(
          `SMTP send failed: ${error instanceof Error ? error.message : String(error)}`,
          !permanent,
          { cause: error },
        );
      }
    },
  };
}
