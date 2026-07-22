import {
  EmailProviderError,
  getEmailSenderConfig,
  htmlToPlainText,
  type EmailMessage,
  type EmailProvider,
} from "~/features/email/delivery/email-provider";

export function createSendGridEmailProvider(): EmailProvider {
  return { send: sendWithSendGrid };
}

async function sendWithSendGrid(input: EmailMessage) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const sender = getEmailSenderConfig();

  if (!apiKey) {
    throw new EmailProviderError(
      "SendGrid is not configured. Set SENDGRID_API_KEY.",
      false,
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: input.to }],
            subject: input.subject,
          },
        ],
        from: {
          email: sender.address,
          ...(sender.name ? { name: sender.name } : {}),
        },
        ...(sender.replyTo ? { reply_to: { email: sender.replyTo } } : {}),
        content: [
          { type: "text/plain", value: input.text ?? htmlToPlainText(input.html) },
          { type: "text/html", value: input.html },
        ],
      }),
    });
  } catch (error) {
    throw new EmailProviderError(
      `SendGrid request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
      { cause: error },
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    throw new EmailProviderError(
      `SendGrid ${response.status} ${response.statusText}: ${errorText}`.slice(
        0,
        1000,
      ),
      retryable,
    );
  }

  return { messageId: response.headers.get("x-message-id") };
}
