import { Prisma, type MessageSender, type QuoteStatus } from "@prisma/client";
import prisma from "~/db.server";

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
