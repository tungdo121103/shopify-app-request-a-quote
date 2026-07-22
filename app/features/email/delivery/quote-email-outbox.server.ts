import prisma from "~/db.server";
import { isValidEmail } from "~/lib/contact-validation";
import { EmailProviderError } from "~/features/email/delivery/email-provider";
import { getEmailProviderStatus } from "~/features/email/delivery/email-provider-factory.server";
import { sendQuoteNotification } from "~/features/email/preview/quote-email-preview.server";
import type { QueueQuoteEmailInput, QuoteEmailContext } from "~/models/quote-email.types";
import type { QuoteEmailTemplateKey } from "~/models/quote-email.shared";

const defaultLocale = "en";

export async function queueQuoteNotification(input: QueueQuoteEmailInput) {
  const recipientEmail = input.quote.customerEmail?.trim().toLowerCase();
  if (!recipientEmail || !isValidEmail(recipientEmail)) return false;

  try {
    const delivery = await prisma.quoteEmailDelivery.create({
      data: {
        shop: input.shop,
        quoteId: input.quote.id,
        event: input.templateKey,
        recipientEmail,
        idempotencyKey: input.idempotencyKey,
        payloadJson: JSON.stringify({
          quote: input.quote,
          locale: input.locale ?? defaultLocale,
        }),
      },
    });
    if (
      process.env.NODE_ENV !== "test" &&
      process.env.QUOTE_EMAIL_SEND_IMMEDIATELY !== "false"
    ) {
      await processQuoteEmailDeliveries(1, input.shop, delivery.id);
    }
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return true;
    }
    throw error;
  }
}

export function getEmailDevelopmentStatus() {
  const providerStatus = getEmailProviderStatus();
  return {
    ...providerStatus,
    // Kept for compatibility with any existing loader consumer.
    sendGridConfigured: Boolean(
      process.env.SENDGRID_API_KEY?.trim() &&
        (process.env.EMAIL_FROM_ADDRESS?.trim() ||
          process.env.SENDGRID_FROM_EMAIL?.trim()),
    ),
    portalSecretConfigured: Boolean(
      process.env.QUOTE_PORTAL_SECRET?.trim() ||
        process.env.SHOPIFY_API_SECRET?.trim(),
    ),
  };
}

export async function getQuoteEmailQueueSummary(shop: string) {
  const [pending, retrying, sent, failed] = await Promise.all([
    prisma.quoteEmailDelivery.count({ where: { shop, status: "PENDING" } }),
    prisma.quoteEmailDelivery.count({ where: { shop, status: "RETRYING" } }),
    prisma.quoteEmailDelivery.count({ where: { shop, status: "SENT" } }),
    prisma.quoteEmailDelivery.count({
      where: { shop, status: "FAILED_PERMANENT" },
    }),
  ]);
  return { pending, retrying, sent, failed };
}

export async function processQuoteEmailDeliveries(
  limit = 25,
  shop?: string,
  deliveryId?: string,
) {
  const now = new Date();
  const staleProcessingAt = new Date(now.getTime() - 10 * 60 * 1000);
  await prisma.quoteEmailDelivery.updateMany({
    where: {
      ...(shop ? { shop } : {}),
      status: "PROCESSING",
      processingAt: { lt: staleProcessingAt },
    },
    data: { status: "RETRYING", processingAt: null, nextAttemptAt: now },
  });

  const candidates = await prisma.quoteEmailDelivery.findMany({
    where: {
      ...(shop ? { shop } : {}),
      ...(deliveryId ? { id: deliveryId } : {}),
      status: { in: ["PENDING", "RETRYING"] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  let sentCount = 0;
  let failedCount = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.quoteEmailDelivery.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["PENDING", "RETRYING"] },
      },
      data: {
        status: "PROCESSING",
        processingAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    try {
      const payload = JSON.parse(candidate.payloadJson) as {
        quote: QuoteEmailContext;
        locale?: string;
      };
      const sent = await sendQuoteNotification({
        shop: candidate.shop,
        quote: payload.quote,
        templateKey: candidate.event as QuoteEmailTemplateKey,
        locale: payload.locale,
        toEmail: candidate.recipientEmail,
      });
      if (!sent) throw new Error("Email provider rejected the message.");

      await prisma.quoteEmailDelivery.update({
        where: { id: candidate.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          processingAt: null,
          lastError: null,
          providerMessageId: sent.messageId,
        },
      });
      sentCount += 1;
    } catch (error) {
      const attempt = candidate.attemptCount + 1;
      const permanent =
        attempt >= 5 ||
        (error instanceof EmailProviderError && !error.retryable);
      const delays = [1, 5, 30, 120];
      const delayMinutes = delays[Math.min(attempt - 1, delays.length - 1)];
      await prisma.quoteEmailDelivery.update({
        where: { id: candidate.id },
        data: {
          status: permanent ? "FAILED_PERMANENT" : "RETRYING",
          processingAt: null,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError: String(error instanceof Error ? error.message : error).slice(0, 1000),
        },
      });
      failedCount += 1;
    }
  }

  return { processedCount: sentCount + failedCount, sentCount, failedCount };
}
