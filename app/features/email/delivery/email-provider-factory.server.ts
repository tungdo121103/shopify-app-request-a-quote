import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
  type EmailSendResult,
} from "~/features/email/delivery/email-provider";
import { createSesEmailProvider } from "~/features/email/delivery/ses-email-provider.server";
import { createSendGridEmailProvider } from "~/features/email/delivery/sendgrid-email-provider.server";
import { createSmtpEmailProvider } from "~/features/email/delivery/smtp-email-provider.server";

export type EmailProviderName = "smtp" | "ses" | "sendgrid";

export function getConfiguredEmailProviderName(): EmailProviderName {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "smtp" || configured === "ses" || configured === "sendgrid") {
    return configured;
  }
  if (configured) {
    throw new EmailProviderError(
      `Unsupported EMAIL_PROVIDER "${configured}". Use smtp, ses, or sendgrid.`,
      false,
    );
  }

  // Backward compatibility for installations that already use SendGrid.
  if (process.env.SENDGRID_API_KEY?.trim()) return "sendgrid";
  if (process.env.NODE_ENV !== "production") return "smtp";

  throw new EmailProviderError(
    "EMAIL_PROVIDER must be configured in production.",
    false,
  );
}

export function createEmailProvider(
  providerName = getConfiguredEmailProviderName(),
): EmailProvider {
  switch (providerName) {
    case "smtp":
      return createSmtpEmailProvider();
    case "ses":
      return createSesEmailProvider();
    case "sendgrid":
      return createSendGridEmailProvider();
  }
}

export function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  return createEmailProvider().send(message);
}

export function getEmailProviderStatus() {
  let provider: EmailProviderName | null = null;
  let configurationError: string | null = null;
  try {
    provider = getConfiguredEmailProviderName();
    createEmailProvider(provider);
  } catch (error) {
    configurationError = error instanceof Error ? error.message : String(error);
  }

  return {
    provider,
    configured: configurationError === null,
    configurationError,
    fromEmail:
      process.env.EMAIL_FROM_ADDRESS?.trim() ||
      process.env.SENDGRID_FROM_EMAIL?.trim() ||
      null,
  };
}
