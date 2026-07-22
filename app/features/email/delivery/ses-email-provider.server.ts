import { createRequire } from "node:module";
import type * as SesV2 from "@aws-sdk/client-sesv2";
import {
  EmailProviderError,
  getEmailSenderConfig,
  htmlToPlainText,
  type EmailProvider,
} from "~/features/email/delivery/email-provider";

// Load the Node/CommonJS export. This prevents Vite SSR from selecting the
// browser ESM build of the AWS SDK while keeping the provider fully typed.
const require = createRequire(import.meta.url);

export function createSesEmailProvider(): EmailProvider {
  const region = process.env.AWS_REGION?.trim();
  if (!region) {
    throw new EmailProviderError(
      "AWS SES is not configured. Set AWS_REGION and AWS credentials or an IAM role.",
      false,
    );
  }

  const { SESv2Client, SendEmailCommand } = require(
    "@aws-sdk/client-sesv2",
  ) as typeof SesV2;
  const client = new SESv2Client({ region });

  return {
    async send(message) {
      const sender = getEmailSenderConfig();
      try {
        const response = await client.send(
          new SendEmailCommand({
            FromEmailAddress: sender.name
              ? `"${sender.name.replace(/"/g, "")}" <${sender.address}>`
              : sender.address,
            Destination: { ToAddresses: [message.to] },
            ReplyToAddresses: sender.replyTo ? [sender.replyTo] : undefined,
            Content: {
              Simple: {
                Subject: { Data: message.subject, Charset: "UTF-8" },
                Body: {
                  Text: {
                    Data: message.text ?? htmlToPlainText(message.html),
                    Charset: "UTF-8",
                  },
                  Html: { Data: message.html, Charset: "UTF-8" },
                },
              },
            },
          }),
        );
        return { messageId: response.MessageId ?? null };
      } catch (error) {
        const name =
          typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
        const permanentErrors = new Set([
          "BadRequestException",
          "MailFromDomainNotVerifiedException",
          "MessageRejected",
          "SendingPausedException",
        ]);
        throw new EmailProviderError(
          `AWS SES send failed: ${error instanceof Error ? error.message : String(error)}`,
          !permanentErrors.has(name),
          { cause: error },
        );
      }
    },
  };
}
