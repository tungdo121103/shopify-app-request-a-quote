import type { QuoteStatus } from "@prisma/client";
import prisma from "~/db.server";
import { assertQuoteStatusTransition } from "~/lib/quote-status";
import { quoteToEmailContext } from "~/features/email/rendering/quote-email-context";
import { queueQuoteNotification } from "~/features/email/quote-email.server";
import { getQuote } from "~/models/quote-query.server";
import { getQuoteSettings } from "~/models/quote-setting.server";

export async function updateQuoteStatus(
  shop: string,
  quoteId: string,
  status: QuoteStatus,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, shop },
    select: { id: true, status: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  assertQuoteStatusTransition(quote.status, status);
  if (quote.status === status) {
    return prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
  }

  const result = await prisma.quote.updateMany({
    where: { id: quote.id, status: quote.status },
    data: {
      status,
      ...(["NEGOTIATING", "ACCEPTED", "DECLINED", "CONVERTED_TO_ORDER"].includes(status)
        ? { expiresAt: null, reminderSentAt: null }
        : {}),
    },
  });
  if (result.count !== 1) {
    throw new Response("Quote status changed in another request. Please refresh and try again.", {
      status: 409,
    });
  }

  const updatedQuote = await prisma.quote.findUniqueOrThrow({
    where: { id: quote.id },
  });

  const wasReopened =
    status === "NEGOTIATING" &&
    (quote.status === "DECLINED" || quote.status === "EXPIRED");
  if (wasReopened) {
    const fullQuote = await getQuote(shop, quoteId);
    if (fullQuote) {
      await queueQuoteNotification({
        shop,
        quote: quoteToEmailContext(fullQuote),
        templateKey: "quote_reopened",
        idempotencyKey: `${shop}:${quoteId}:quote_reopened:v${fullQuote.offerVersion}`,
      });
    }
  }

  return updatedQuote;
}

export async function updateQuotePrices(input: {
  shop: string;
  quoteId: string;
  items: Array<{ id: string; quotePrice: number; quantity?: number }>;
  status?: QuoteStatus;
}) {
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    include: { items: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  if (input.status) {
    assertQuoteStatusTransition(quote.status, input.status);
  }

  const prices = new Map(input.items.map((item) => [item.id, item.quotePrice]));
  const quantities = new Map(
    input.items.map((item) => [
      item.id,
      Math.max(1, Math.floor(Number(item.quantity ?? 1))),
    ]),
  );
  const invalidItem = input.items.find(
    (item) =>
      !quote.items.some((quoteItem) => quoteItem.id === item.id) ||
      !Number.isFinite(item.quotePrice) ||
      item.quotePrice < 0 ||
      !Number.isFinite(Number(item.quantity ?? 1)) ||
      Number(item.quantity ?? 1) < 1,
  );
  if (invalidItem) {
    throw new Response("Invalid quote item price", { status: 400 });
  }

  const originalTotal = quote.items.reduce((total, item) => {
    const quantity = quantities.get(item.id) ?? item.quantity;
    return total + item.unitPrice.toNumber() * quantity;
  }, 0);

  const quoteTotal = quote.items.reduce((total, item) => {
    const price = prices.get(item.id) ?? item.quotePrice.toNumber();
    const quantity = quantities.get(item.id) ?? item.quantity;
    return total + price * quantity;
  }, 0);
  const quantityChanges = quote.items
    .map((item) => {
      const nextQuantity = quantities.get(item.id) ?? item.quantity;
      if (nextQuantity === item.quantity) return null;
      return {
        id: item.id,
        title: item.title,
        previousQuantity: item.quantity,
        quantity: nextQuantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const priceChanges = quote.items
    .map((item) => {
      const nextPrice = prices.get(item.id) ?? item.quotePrice.toNumber();
      if (nextPrice === item.quotePrice.toNumber()) return null;
      return {
        id: item.id,
        title: item.title,
        previousQuotePrice: item.quotePrice.toNumber(),
        quotePrice: nextPrice,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const shouldSetExpiration = input.status === "OFFERED_BY_MERCHANT";
  const expiresAt = shouldSetExpiration
    ? await getQuoteExpirationDate(input.shop)
    : undefined;

  const result = await prisma.$transaction([
    ...input.items.map((item) =>
      prisma.quoteItem.update({
        where: { id: item.id },
        data: {
          quotePrice: item.quotePrice,
          quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
          ...(shouldSetExpiration
            ? {
                lastOfferedQuotePrice: item.quotePrice,
                lastOfferedQuantity: Math.max(
                  1,
                  Math.floor(Number(item.quantity ?? 1)),
                ),
              }
            : {}),
        },
      }),
    ),
    prisma.quote.update({
      where: { id: quote.id },
      data: {
        originalTotal,
        quoteTotal,
        ...(input.status ? { status: input.status } : {}),
        ...(shouldSetExpiration ? { offerVersion: { increment: 1 } } : {}),
        ...(shouldSetExpiration ? { expiresAt } : {}),
      },
    }),
  ]);
  if (shouldSetExpiration) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { reminderSentAt: null },
    });
  }

  if (input.status === "OFFERED_BY_MERCHANT") {
    const fullQuote = await getQuote(input.shop, input.quoteId);
    if (fullQuote) {
      await queueQuoteNotification({
        shop: input.shop,
        quote: quoteToEmailContext(fullQuote),
        templateKey: "offer_sent",
        idempotencyKey: `${input.shop}:${input.quoteId}:offer_sent:v${fullQuote.offerVersion}`,
      });
    }
  }

  return { result, quantityChanges, priceChanges };
}

export async function addQuoteItem(input: {
  shop: string;
  quoteId: string;
  productId?: string;
  variantId?: string;
  variantTitle?: string;
  title: string;
  imageUrl?: string;
  sku?: string;
  quantity?: number;
  unitPrice: number;
  quotePrice?: number;
}) {
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    include: { items: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  const quantity = Math.max(1, Number(input.quantity || 1));
  const unitPrice = Math.max(0, Number(input.unitPrice || 0));
  const quotePrice = Math.max(0, Number(input.quotePrice ?? unitPrice));

  return prisma.$transaction(async (tx) => {
    await tx.quoteItem.create({
      data: {
        quoteId: quote.id,
        productId: input.productId,
        variantId: input.variantId,
        variantTitle: input.variantTitle,
        title: input.title,
        imageUrl: input.imageUrl,
        sku: input.sku,
        quantity,
        unitPrice,
        quotePrice,
        inventoryStatus: "AVAILABLE",
      },
    });

    const originalTotal =
      quote.items.reduce(
        (total, item) => total + item.unitPrice.toNumber() * item.quantity,
        0,
      ) +
      unitPrice * quantity;
    const quoteTotal =
      quote.items.reduce(
        (total, item) => total + item.quotePrice.toNumber() * item.quantity,
        0,
      ) +
      quotePrice * quantity;

    return tx.quote.update({
      where: { id: quote.id },
      data: { originalTotal, quoteTotal },
      include: { items: true },
    });
  });
}

async function getQuoteExpirationDate(shop: string) {
  const settings = await getQuoteSettings(shop);
  const expiresAfterDays = Math.max(0, settings.quoteExpiresAfterDays);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresAfterDays);
  return expiresAt;
}

export async function markQuoteConverted(input: {
  shop: string;
  quoteId: string;
  orderId: string;
  orderName?: string;
  orderInvoiceUrl?: string;
}) {
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    select: { id: true, status: true, orderId: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  if (quote.status === "CONVERTED_TO_ORDER" && quote.orderId === input.orderId) {
    return prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
  }
  assertQuoteStatusTransition(quote.status, "CONVERTED_TO_ORDER");

  const transition = await prisma.quote.updateMany({
    where: { id: quote.id, status: quote.status, orderId: null },
    data: {
      status: "CONVERTED_TO_ORDER",
      orderId: input.orderId,
      orderName: input.orderName,
      orderInvoiceUrl: input.orderInvoiceUrl,
      expiresAt: null,
      reminderSentAt: null,
    },
  });
  if (transition.count !== 1) {
    throw new Response("Quote was already converted or changed in another request.", {
      status: 409,
    });
  }
  const updatedQuote = await prisma.quote.findUniqueOrThrow({
    where: { id: quote.id },
  });

  const fullQuote = await getQuote(input.shop, input.quoteId);
  if (fullQuote) {
    await queueQuoteNotification({
      shop: input.shop,
      quote: quoteToEmailContext(fullQuote),
      templateKey: "quote_converted",
      idempotencyKey: `${input.shop}:${input.quoteId}:quote_converted`,
    });
  }

  return updatedQuote;
}
