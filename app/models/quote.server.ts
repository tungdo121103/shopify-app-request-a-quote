import { Prisma, type MessageSender, type QuoteStatus } from "@prisma/client";
import prisma from "~/db.server";
import { getQuoteSettings } from "~/models/quote-setting.server";
import { queueQuoteNotification } from "~/models/quote-email.server";
import { assertQuoteStatusTransition } from "~/lib/quote-status";
import {
  normalizeClientMessageId,
  QUOTE_MESSAGE_BURST_LIMIT,
  QUOTE_MESSAGE_MINUTE_LIMIT,
  QUOTE_MESSAGE_SHOP_MINUTE_LIMIT,
  validateQuoteMessage,
} from "~/lib/quote-message-policy";

function makeReadStateId(quoteId: string, viewer: string, viewerId: string) {
  return `read_${quoteId}_${viewer}_${viewerId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
}

export async function markQuoteRead(input: {
  shop: string;
  quoteId: string;
  viewer: "CUSTOMER" | "MANAGER";
  viewerId?: string | null;
}) {
  const viewerId = input.viewerId || input.shop;
  await prisma.quoteReadState.upsert({
    where: {
      quoteId_viewer_viewerId: {
        quoteId: input.quoteId,
        viewer: input.viewer,
        viewerId,
      },
    },
    create: {
      id: makeReadStateId(input.quoteId, input.viewer, viewerId),
      shop: input.shop,
      quoteId: input.quoteId,
      viewer: input.viewer,
      viewerId,
      lastReadAt: new Date(),
    },
    update: { lastReadAt: new Date() },
  });
}

async function getUnreadCountsForQuotes(input: {
  shop: string;
  quoteIds: string[];
  viewer: "CUSTOMER" | "MANAGER";
  viewerId?: string | null;
  ignoredSender: MessageSender;
  includeUnopenedQuote?: boolean;
}) {
  const uniqueQuoteIds = [...new Set(input.quoteIds.filter(Boolean))];
  const counts = new Map<string, number>();
  if (!uniqueQuoteIds.length) return counts;

  const viewerId = input.viewerId || input.shop;
  const readRows = await prisma.quoteReadState.findMany({
    where: {
      quoteId: { in: uniqueQuoteIds },
      viewer: input.viewer,
      viewerId,
    },
    select: { quoteId: true, lastReadAt: true },
  });
  const readAtByQuote = new Map(
    readRows.map((row) => [row.quoteId, new Date(row.lastReadAt)]),
  );

  await Promise.all(
    uniqueQuoteIds.map(async (quoteId) => {
      const lastReadAt = readAtByQuote.get(quoteId) ?? new Date(0);
      const count = await prisma.conversationMessage.count({
        where: {
          quoteId,
          sender: { not: input.ignoredSender },
          createdAt: { gt: lastReadAt },
        },
      });
      const quoteHasNeverBeenOpened = !readAtByQuote.has(quoteId);
      counts.set(
        quoteId,
        input.includeUnopenedQuote && quoteHasNeverBeenOpened
          ? Math.max(1, count)
          : count,
      );
    }),
  );
  return counts;
}

export async function listQuotes(
  shop: string,
  filters: {
    search?: string;
    status?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize || 10)));
  const orderBy:
    | Prisma.QuoteOrderByWithRelationInput
    | Prisma.QuoteOrderByWithRelationInput[] =
    filters.sort === "UPDATED_ASC"
      ? { updatedAt: "asc" }
      : filters.sort === "CREATED_ASC"
        ? { createdAt: "asc" }
        : filters.sort === "VALUE_DESC"
          ? { quoteTotal: "desc" }
          : filters.sort === "VALUE_ASC"
            ? { quoteTotal: "asc" }
            : filters.sort === "CUSTOMER_ASC"
              ? [{ customerEmail: "asc" }, { customerName: "asc" }]
              : filters.sort === "CUSTOMER_DESC"
                ? [{ customerEmail: "desc" }, { customerName: "desc" }]
                : filters.sort === "EXPIRES_ASC"
                  ? { expiresAt: "asc" }
                  : { updatedAt: "desc" };

  const where: Prisma.QuoteWhereInput = {
    shop,
    ...(filters.search
      ? {
          OR: [
            { quoteNumber: { contains: filters.search } },
            { customerName: { contains: filters.search } },
            { customerEmail: { contains: filters.search } },
          ],
        }
      : {}),
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status as QuoteStatus }
      : {}),
  };

  const [total, quotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      include: { _count: { select: { items: true, messages: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const unreadCounts = await getUnreadCountsForQuotes({
    shop,
    quoteIds: quotes.map((quote) => quote.id),
    viewer: "MANAGER",
    viewerId: "manager",
    ignoredSender: "MANAGER",
    includeUnopenedQuote: true,
  });

  return {
    quotes: quotes.map((quote) => ({
      ...quote,
      originalTotal: quote.originalTotal.toNumber(),
      quoteTotal: quote.quoteTotal.toNumber(),
      unreadCount: unreadCounts.get(quote.id) ?? 0,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function deleteQuote(shop: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, shop },
    select: { id: true },
  });
  if (!quote) return null;

  return prisma.quote.delete({ where: { id: quote.id } });
}

export async function getQuote(shop: string, id: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, shop },
    include: {
      items: true,
      messages: {
        include: { attachments: true },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
    },
  });

  if (!quote) return null;

  return {
    ...quote,
    originalTotal: quote.originalTotal.toNumber(),
    quoteTotal: quote.quoteTotal.toNumber(),
    items: quote.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toNumber(),
      quotePrice: item.quotePrice.toNumber(),
    })),
  };
}

export async function getLatestQuote(shop: string) {
  const quote = await prisma.quote.findFirst({
    where: { shop },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  if (!quote) return null;

  return {
    ...quote,
    originalTotal: quote.originalTotal.toNumber(),
    quoteTotal: quote.quoteTotal.toNumber(),
    items: quote.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toNumber(),
      quotePrice: item.quotePrice.toNumber(),
    })),
  };
}

export async function addMessage(input: {
  quoteId: string;
  shop: string;
  sender: MessageSender;
  senderName?: string;
  message: string;
  messageType?: "USER" | "SYSTEM";
  eventType?: string;
  clientMessageId?: string | null;
  sourceIpHash?: string | null;
  sourceActorHash?: string | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
}) {
  const clientMessageId = normalizeClientMessageId(input.clientMessageId);
  const normalizedMessage = input.message.trim();
  const validationError = validateQuoteMessage({
    message: normalizedMessage,
    attachments: input.attachments,
  });
  if (validationError) throw new Response(validationError, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    select: { id: true, status: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });
  if (clientMessageId) {
    const existingMessage = await prisma.conversationMessage.findFirst({
      where: { quoteId: quote.id, sender: input.sender, clientMessageId },
      include: { attachments: true },
    });
    if (existingMessage) return existingMessage;
  }
  if (
    (input.messageType ?? "USER") === "USER" &&
    quote.status === "CONVERTED_TO_ORDER"
  ) {
    throw new Response("This quote is closed and can no longer receive messages.", {
      status: 409,
    });
  }

  if ((input.messageType ?? "USER") === "USER") {
    const now = Date.now();
    const minuteAgo = new Date(now - 60_000);
    const burstAgo = new Date(now - 10_000);
    const [burstCount, minuteCount, shopCount, ipCount, actorCount] =
      await Promise.all([
      prisma.conversationMessage.count({
        where: {
          quoteId: quote.id,
          sender: input.sender,
          messageType: "USER",
          createdAt: { gte: burstAgo },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          quoteId: quote.id,
          sender: input.sender,
          messageType: "USER",
          createdAt: { gte: minuteAgo },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          quote: { shop: input.shop },
          messageType: "USER",
          createdAt: { gte: minuteAgo },
        },
      }),
      input.sourceIpHash
        ? prisma.conversationMessage.count({
            where: {
              sourceIpHash: input.sourceIpHash,
              messageType: "USER",
              createdAt: { gte: minuteAgo },
            },
          })
        : Promise.resolve(0),
      input.sourceActorHash
        ? prisma.conversationMessage.count({
            where: {
              sourceActorHash: input.sourceActorHash,
              messageType: "USER",
              createdAt: { gte: minuteAgo },
            },
          })
        : Promise.resolve(0),
    ]);
    if (
      burstCount >= QUOTE_MESSAGE_BURST_LIMIT ||
      minuteCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      ipCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      actorCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      shopCount >= QUOTE_MESSAGE_SHOP_MINUTE_LIMIT
    ) {
      throw new Response("Too many messages. Please wait and try again.", {
        status: 429,
        headers: { "Retry-After": "10" },
      });
    }
  }

  const createMessage = () => prisma.$transaction(async (tx) => {
    if (clientMessageId) {
      const duplicate = await tx.conversationMessage.findFirst({
        where: { quoteId: quote.id, sender: input.sender, clientMessageId },
        include: { attachments: true },
      });
      if (duplicate) return { message: duplicate, negotiationStarted: false };
    }
    const message = await tx.conversationMessage.create({
      data: {
        quoteId: quote.id,
        clientMessageId,
        sourceIpHash: input.sourceIpHash,
        sourceActorHash: input.sourceActorHash,
        sender: input.sender,
        senderName: input.senderName,
        message: normalizedMessage,
        messageType: input.messageType ?? "USER",
        eventType: input.eventType,
      },
    });

    if (input.attachments?.length) {
      await tx.quoteAttachment.createMany({
        data: input.attachments.map((attachment) => ({
          ...attachment,
          quoteId: quote.id,
          messageId: message.id,
        })),
      });
    }

    const negotiationStarted = input.sender === "MANAGER"
      ? (await tx.quote.updateMany({
          where: { id: quote.id, status: "REQUESTED_BY_CUSTOMER" },
          data: { status: "NEGOTIATING", expiresAt: null },
        })).count === 1
      : false;

    const storedMessage = await tx.conversationMessage.findUniqueOrThrow({
      where: { id: message.id },
      include: { attachments: true },
    });
    return { message: storedMessage, negotiationStarted };
  });

  let result;
  try {
    result = await createMessage();
  } catch (error) {
    if (clientMessageId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.conversationMessage.findFirst({
        where: { quoteId: quote.id, sender: input.sender, clientMessageId },
        include: { attachments: true },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }

  if (result.negotiationStarted) {
    const fullQuote = await getQuote(input.shop, input.quoteId);
    if (fullQuote) {
      await queueQuoteNotification({
        shop: input.shop,
        quote: quoteToEmailContext(fullQuote),
        templateKey: "negotiation_started",
        idempotencyKey: `${input.shop}:${input.quoteId}:negotiation_started`,
      });
    }
  }

  return result.message;
}

type NumberValue = number | { toNumber: () => number } | string;

type QuoteEmailSource = {
  id: string;
  quoteNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  quoteTotal: NumberValue;
  originalTotal: NumberValue;
  currency: string;
  status: QuoteStatus | string;
  note?: string | null;
  expiresAt?: Date | string | null;
  orderInvoiceUrl?: string | null;
  orderName?: string | null;
  items: Array<{
    title: string;
    quantity: number;
    quotePrice: NumberValue;
    unitPrice: NumberValue;
    imageUrl?: string | null;
    sku?: string | null;
    variantTitle?: string | null;
  }>;
};

function toNumber(value: NumberValue) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value.toNumber === "function") {
    return Number(value.toNumber());
  }
  return 0;
}

function quoteToEmailContext(quote: QuoteEmailSource) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName || "Customer",
    customerEmail: quote.customerEmail ?? null,
    quoteTotal: toNumber(quote.quoteTotal),
    originalTotal: toNumber(quote.originalTotal),
    currency: quote.currency,
    status: String(quote.status),
    note: quote.note ?? null,
    expiresAt: quote.expiresAt ? String(quote.expiresAt) : null,
    orderInvoiceUrl: quote.orderInvoiceUrl ?? null,
    orderName: quote.orderName ?? null,
    items: quote.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      quotePrice: toNumber(item.quotePrice),
      unitPrice: toNumber(item.unitPrice),
      imageUrl: item.imageUrl ?? undefined,
      sku: item.sku ?? undefined,
      variantTitle: item.variantTitle ?? undefined,
    })),
  };
}

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

  return prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
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

export async function listCustomerQuotes(
  shop: string,
  customerId: string,
  customerEmail?: string,
) {
  const normalizedEmail = customerEmail?.trim();
  const quotes = await prisma.quote.findMany({
    where: {
      shop,
      OR: [
        { customerId },
        ...(normalizedEmail ? [{ customerEmail: normalizedEmail }] : []),
      ],
    },
    include: { _count: { select: { items: true, messages: true } } },
    orderBy: { createdAt: "desc" },
  });
  const unreadCounts = await getUnreadCountsForQuotes({
    shop,
    quoteIds: quotes.map((quote) => quote.id),
    viewer: "CUSTOMER",
    viewerId: customerId || normalizedEmail || "customer",
    ignoredSender: "CUSTOMER",
  });

  return quotes.map((quote) => ({
    ...quote,
    originalTotal: quote.originalTotal.toNumber(),
    quoteTotal: quote.quoteTotal.toNumber(),
    unreadCount: unreadCounts.get(quote.id) ?? 0,
  }));
}
