import type { MessageSender, QuoteStatus } from "@prisma/client";
import prisma from "~/db.server";
import { quoteToEmailContext } from "~/features/email/rendering/quote-email-context";
import { queueQuoteNotification } from "~/features/email/quote-email.server";
import { getQuote } from "~/models/quote-query.server";
import { getQuoteSettings } from "~/models/quote-setting.server";

export async function runQuoteExpirationJobs(input: {
  shop: string;
  quoteId?: string;
  includeReminders?: boolean;
}) {
  const now = new Date();
  const settings = await getQuoteSettings(input.shop);
  const includeReminders = input.includeReminders ?? true;

  const expiringQuotes = await prisma.quote.findMany({
    where: {
      shop: input.shop,
      ...(input.quoteId ? { id: input.quoteId } : {}),
      status: "OFFERED_BY_MERCHANT",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      quoteNumber: true,
      shop: true,
      customerEmail: true,
      expiresAt: true,
    },
  });

  const expiredQuotes = expiringQuotes.length
    ? await prisma.$transaction(async (tx) => {
        const claimed = [];
        for (const quote of expiringQuotes) {
          const result = await tx.quote.updateMany({
            where: { id: quote.id, status: "OFFERED_BY_MERCHANT" },
            data: { status: "EXPIRED" as QuoteStatus },
          });
          if (result.count === 1) claimed.push(quote);
        }

        if (claimed.length) {
          await tx.conversationMessage.createMany({
          data: claimed.map((quote) => ({
              quoteId: quote.id,
              sender: "MANAGER" as MessageSender,
              senderName: "System",
              message: "This quote has expired.",
              messageType: "SYSTEM",
              eventType: "QUOTE_EXPIRED",
            })),
          });
        }
        return claimed;
      })
    : [];

  const reminderWindowStart = new Date();
  reminderWindowStart.setDate(
    reminderWindowStart.getDate() + settings.reminderBeforeExpireDays,
  );

  const reminderCandidates = !includeReminders || settings.reminderBeforeExpireDays <= 0
    ? []
    : await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      quoteNumber: string;
      shop: string;
      customerEmail: string | null;
      expiresAt: string | Date | null;
      offerVersion: number;
    }>
  >(
    `
      SELECT "id", "quoteNumber", "shop", "customerEmail", "expiresAt", "offerVersion"
      FROM "Quote"
      WHERE "shop" = ?
        ${input.quoteId ? `AND "id" = ?` : ""}
        AND "status" = 'OFFERED_BY_MERCHANT'
        AND "expiresAt" IS NOT NULL
        AND "expiresAt" <= ?
        AND "expiresAt" >= ?
        AND "reminderSentAt" IS NULL
    `,
    ...(input.quoteId
      ? [
          input.shop,
          input.quoteId,
          reminderWindowStart.toISOString(),
          now.toISOString(),
        ]
      : [input.shop, reminderWindowStart.toISOString(), now.toISOString()]),
  );

  const remindedQuoteIds: string[] = [];
  for (const quote of reminderCandidates) {
    const fullQuote = await getQuote(input.shop, quote.id);
    if (!fullQuote) continue;
    await queueQuoteNotification({
      shop: quote.shop,
      quote: quoteToEmailContext(fullQuote),
      templateKey: "quote_reminder",
      idempotencyKey: `${quote.shop}:${quote.id}:quote_reminder:v${quote.offerVersion}`,
    });
    remindedQuoteIds.push(quote.id);
  }

  if (remindedQuoteIds.length) {
    await prisma.quote.updateMany({
      where: { id: { in: remindedQuoteIds } },
      data: { reminderSentAt: now },
    });
  }

  for (const quote of expiredQuotes) {
    const fullQuote = await getQuote(input.shop, quote.id);
    if (!fullQuote) continue;
    await queueQuoteNotification({
      shop: input.shop,
      quote: quoteToEmailContext(fullQuote),
      templateKey: "quote_expired",
      idempotencyKey: `${input.shop}:${quote.id}:quote_expired:v${fullQuote.offerVersion}`,
    });
  }

  return {
    expiredCount: expiredQuotes.length,
    reminderCount: remindedQuoteIds.length,
  };
}

export async function runAllQuoteExpirationJobs() {
  const shops = await prisma.quote.findMany({
    distinct: ["shop"],
    select: { shop: true },
  });

  const results = await Promise.all(
    shops.map(async ({ shop }) => ({
      shop,
      ...(await runQuoteExpirationJobs({ shop, includeReminders: true })),
    })),
  );

  return {
    shopsProcessed: results.length,
    expiredCount: results.reduce((total, item) => total + item.expiredCount, 0),
    reminderCount: results.reduce(
      (total, item) => total + item.reminderCount,
      0,
    ),
    results,
  };
}
