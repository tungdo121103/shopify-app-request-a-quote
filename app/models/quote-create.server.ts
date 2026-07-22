import { Prisma } from "@prisma/client";
import prisma from "~/db.server";
import { quoteToEmailContext } from "~/features/email/rendering/quote-email-context";
import { queueQuoteNotification } from "~/features/email/quote-email.server";
import { getQuote } from "~/models/quote-query.server";

export async function createStorefrontQuote(input: {
  shop: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCountry?: string;
  customerRegion?: string;
  customerAddress?: string;
  currency?: string;
  note?: string;
  items: Array<{
    productId?: string;
    variantId?: string;
    variantTitle?: string;
    title: string;
    imageUrl?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    quotePrice: number;
    inventoryStatus?: string;
  }>;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
}) {
  const initialCustomerMessage = input.note?.trim() ?? "";
  const originalTotal = input.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const quoteTotal = input.items.reduce(
    (sum, item) => sum + item.quotePrice * item.quantity,
    0,
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const createdQuote = await prisma.$transaction(async (tx) => {
        const quoteNumber = await reserveNextQuoteNumber(tx, input.shop);

        const quote = await tx.quote.create({
          data: {
            quoteNumber,
            shop: input.shop,
            customerId: input.customerId,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            customerCountry: input.customerCountry,
            customerRegion: input.customerRegion,
            currency: input.currency ?? "USD",
            note: input.note,
            originalTotal,
            quoteTotal,
            messages: initialCustomerMessage
              ? {
                  create: {
                    sender: "CUSTOMER",
                    senderName:
                      input.customerName?.trim() ||
                      input.customerEmail?.trim() ||
                      "Customer",
                    message: initialCustomerMessage,
                    messageType: "USER",
                  },
                }
              : undefined,
            items: {
              create: input.items.map((item) => ({
                ...item,
                lastOfferedQuantity: item.quantity,
                lastOfferedQuotePrice: item.quotePrice,
              })),
            },
            attachments: input.attachments?.length
              ? { create: input.attachments }
              : undefined,
          } as never,
          include: { items: true, attachments: true },
        });

        if (input.customerAddress) {
          await tx.$executeRaw`
            UPDATE "Quote"
            SET "customerAddress" = ${input.customerAddress}
            WHERE "id" = ${quote.id}
          `;
        }

        return quote;
      });

      const fullQuote = await getQuote(input.shop, createdQuote.id);
      if (fullQuote) {
        await queueQuoteNotification({
          shop: input.shop,
          quote: quoteToEmailContext(fullQuote),
          templateKey: "quote_requested",
          idempotencyKey: `${input.shop}:${createdQuote.id}:quote_requested`,
        });
      }

      return createdQuote;
    } catch (error) {
      if (attempt < 4 && isQuoteNumberCollision(error)) continue;
      throw error;
    }
  }

  throw new Error("Could not reserve a quote number");
}

async function reserveNextQuoteNumber(
  tx: Prisma.TransactionClient,
  shop: string,
) {
  const key = "quote";
  const existingCounter = await tx.shopCounter.findUnique({
    where: { shop_key: { shop, key } },
  });

  const counter = existingCounter
    ? await tx.shopCounter.update({
        where: { shop_key: { shop, key } },
        data: { value: { increment: 1 } },
      })
    : await tx.shopCounter.upsert({
        where: { shop_key: { shop, key } },
        create: {
          shop,
          key,
          value: (await getInitialQuoteCounterValue(tx, shop)) + 1,
        },
        update: { value: { increment: 1 } },
      });

  return `RFQ-${String(counter.value).padStart(5, "0")}`;
}

async function getInitialQuoteCounterValue(
  tx: Prisma.TransactionClient,
  shop: string,
) {
  const latestQuotes = await tx.quote.findMany({
    where: {
      shop,
      quoteNumber: { startsWith: "RFQ-" },
    },
    select: { quoteNumber: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return latestQuotes.reduce((latest, quote) => {
    const match = /^RFQ-(\d+)$/.exec(quote.quoteNumber);
    return latest || (match ? Number(match[1]) : 0);
  }, 0);
}

function isQuoteNumberCollision(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("shop") && target.includes("quoteNumber")
    : String(target ?? "").includes("quoteNumber");
}
