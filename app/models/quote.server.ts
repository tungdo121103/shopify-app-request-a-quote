import { Prisma, type MessageSender, type QuoteStatus } from "@prisma/client";
import prisma from "~/db.server";
import { getQuoteSettings } from "~/models/quote-setting.server";

const demoItems = [
  {
    title: "The 3p Fulfilled Snowboard",
    quantity: 1,
    unitPrice: 2629.95,
    quotePrice: 2498.45,
    inventoryStatus: "OUT_OF_STOCK",
  },
  {
    title: "The Inventory Not Tracked Snowboard",
    quantity: 1,
    unitPrice: 949.95,
    quotePrice: 902.45,
    inventoryStatus: "AVAILABLE",
  },
  {
    title: "The Collection Snowboard: Oxygen",
    quantity: 1,
    unitPrice: 1025,
    quotePrice: 973.75,
    inventoryStatus: "AVAILABLE",
  },
];

async function ensureQuoteReminderColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("Quote")`,
  );
  if (columns.some((column) => column.name === "reminderSentAt")) return;

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Quote" ADD COLUMN "reminderSentAt" DATETIME`,
  );
}

async function expireOverdueQuotes(shop: string, quoteId?: string) {
  await runQuoteExpirationJobs({
    shop,
    quoteId,
    includeReminders: false,
  });
}

async function ensureQuoteReadStateTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuoteReadState" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "shop" TEXT NOT NULL,
      "quoteId" TEXT NOT NULL,
      "viewer" TEXT NOT NULL,
      "viewerId" TEXT NOT NULL DEFAULT '',
      "lastReadAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      UNIQUE("quoteId", "viewer", "viewerId")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "QuoteReadState_shop_viewer_idx"
    ON "QuoteReadState" ("shop", "viewer")
  `);
}

function makeReadStateId(quoteId: string, viewer: string, viewerId: string) {
  return `read_${quoteId}_${viewer}_${viewerId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function markQuoteRead(input: {
  shop: string;
  quoteId: string;
  viewer: "CUSTOMER" | "MANAGER";
  viewerId?: string | null;
}) {
  await ensureQuoteReadStateTable();
  const viewerId = input.viewerId || input.shop;
  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "QuoteReadState" ("id", "shop", "quoteId", "viewer", "viewerId", "lastReadAt", "updatedAt")
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT("quoteId", "viewer", "viewerId")
      DO UPDATE SET "lastReadAt" = excluded."lastReadAt", "updatedAt" = excluded."updatedAt"
    `,
    makeReadStateId(input.quoteId, input.viewer, viewerId),
    input.shop,
    input.quoteId,
    input.viewer,
    viewerId,
    now,
    now,
  );
}

async function getUnreadCountsForQuotes(input: {
  shop: string;
  quoteIds: string[];
  viewer: "CUSTOMER" | "MANAGER";
  viewerId?: string | null;
  ignoredSender: MessageSender;
}) {
  const uniqueQuoteIds = [...new Set(input.quoteIds.filter(Boolean))];
  const counts = new Map<string, number>();
  if (!uniqueQuoteIds.length) return counts;

  await ensureQuoteReadStateTable();
  const viewerId = input.viewerId || input.shop;
  const placeholders = uniqueQuoteIds.map(() => "?").join(", ");
  const readRows = await prisma.$queryRawUnsafe<
    Array<{ quoteId: string; lastReadAt: string | Date }>
  >(
    `
      SELECT "quoteId", "lastReadAt"
      FROM "QuoteReadState"
      WHERE "quoteId" IN (${placeholders})
        AND "viewer" = ?
        AND "viewerId" = ?
    `,
    ...uniqueQuoteIds,
    input.viewer,
    viewerId,
  );
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
      counts.set(quoteId, count);
    }),
  );
  return counts;
}

export async function ensureDemoQuote(shop: string) {
  const existing = await prisma.quote.findFirst({ where: { shop } });
  if (existing) return existing;

  return prisma.quote.create({
    data: {
      quoteNumber: `RFQ-${Date.now().toString().slice(-5)}`,
      shop,
      customerId: "demo-customer",
      customerName: "Demo buyer",
      customerEmail: "buyer@example.com",
      status: "REQUESTED_BY_CUSTOMER",
      originalTotal: 4604.9,
      quoteTotal: 4374.65,
      note: "Please quote your best wholesale price.",
      items: { create: demoItems },
    },
  });
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
  await ensureDemoQuote(shop);
  await expireOverdueQuotes(shop);
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
  await expireOverdueQuotes(shop, id);
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

export async function addMessage(input: {
  quoteId: string;
  shop: string;
  sender: MessageSender;
  senderName?: string;
  message: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
}) {
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    select: { id: true, status: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });
  const nextStatus =
    quote.status === "REQUESTED_BY_CUSTOMER"
      ? "NEGOTIATING"
      : quote.status;

  return prisma.$transaction(async (tx) => {
    const message = await tx.conversationMessage.create({
      data: {
        quoteId: quote.id,
        sender: input.sender,
        senderName: input.senderName,
        message: input.message,
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

    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: nextStatus,
        ...(nextStatus === "NEGOTIATING" ? { expiresAt: null } : {}),
      },
    });

    return message;
  });
}

export async function updateQuoteStatus(
  shop: string,
  quoteId: string,
  status: QuoteStatus,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, shop },
    select: { id: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  return prisma.quote.update({
    where: { id: quote.id },
    data: {
      status,
      ...(status === "NEGOTIATING" ? { expiresAt: null } : {}),
    },
  });
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
        },
      }),
    ),
    prisma.quote.update({
      where: { id: quote.id },
      data: {
        originalTotal,
        quoteTotal,
        ...(input.status ? { status: input.status } : {}),
        ...(shouldSetExpiration ? { expiresAt } : {}),
      },
    }),
  ]);
  if (shouldSetExpiration) {
    await ensureQuoteReminderColumns();
    await prisma.$executeRawUnsafe(
      `UPDATE "Quote" SET "reminderSentAt" = NULL WHERE "id" = ?`,
      quote.id,
    );
  }
  return { result, quantityChanges, priceChanges };
}

export async function addQuoteItem(input: {
  shop: string;
  quoteId: string;
  productId?: string;
  variantId?: string;
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
  await ensureQuoteReminderColumns();

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

  if (expiringQuotes.length) {
    await prisma.$transaction(async (tx) => {
      await tx.quote.updateMany({
        where: {
          id: { in: expiringQuotes.map((quote) => quote.id) },
          status: "OFFERED_BY_MERCHANT",
        },
        data: { status: "EXPIRED" as QuoteStatus },
      });

      await tx.conversationMessage.createMany({
        data: expiringQuotes.map((quote) => ({
          quoteId: quote.id,
          sender: "MANAGER" as MessageSender,
          senderName: "System",
          message: "This quote has expired.",
        })),
      });
    });
  }

  if (!includeReminders || settings.reminderBeforeExpireDays <= 0) {
    return {
      expiredCount: expiringQuotes.length,
      reminderCount: 0,
    };
  }

  const reminderWindowStart = new Date();
  reminderWindowStart.setDate(
    reminderWindowStart.getDate() + settings.reminderBeforeExpireDays,
  );

  const reminderCandidates = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      quoteNumber: string;
      shop: string;
      customerEmail: string | null;
      expiresAt: string | Date | null;
    }>
  >(
    `
      SELECT "id", "quoteNumber", "shop", "customerEmail", "expiresAt"
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
    const sent = await sendQuoteReminderEmail({
      shop: quote.shop,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerEmail: quote.customerEmail,
      expiresAt: quote.expiresAt,
    });
    if (sent) remindedQuoteIds.push(quote.id);
  }

  if (remindedQuoteIds.length) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "Quote"
        SET "reminderSentAt" = ?
        WHERE "id" IN (${remindedQuoteIds.map(() => "?").join(", ")})
      `,
      now.toISOString(),
      ...remindedQuoteIds,
    );
  }

  return {
    expiredCount: expiringQuotes.length,
    reminderCount: remindedQuoteIds.length,
  };
}

async function sendQuoteReminderEmail(input: {
  shop: string;
  quoteId: string;
  quoteNumber: string;
  customerEmail: string | null;
  expiresAt: string | Date | null;
}) {
  if (!input.customerEmail) return false;

  // Production hook: replace this with your email provider/Shopify email flow.
  // Returning true marks the reminder as queued/sent once, so the scheduler
  // does not spam the same customer every time it runs.
  console.info(
    `[quote-reminder] ${input.shop} ${input.quoteNumber} -> ${input.customerEmail} expires ${input.expiresAt}`,
  );
  return true;
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
    select: { id: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });

  return prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "CONVERTED_TO_ORDER",
      orderId: input.orderId,
      orderName: input.orderName,
      orderInvoiceUrl: input.orderInvoiceUrl,
    },
  });
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
    title: string;
    imageUrl?: string;
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
      return await prisma.$transaction(async (tx) => {
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
            items: { create: input.items },
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
  await expireOverdueQuotes(shop);
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
