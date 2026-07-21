import prisma from "~/db.server";

type CustomerIdentity = {
  id?: string | number | null;
  email?: string | null;
};

function customerWhere(shop: string, customer: CustomerIdentity) {
  const customerId = String(customer.id ?? "").trim();
  const customerEmail = String(customer.email ?? "").trim().toLowerCase();
  const ids = customerId
    ? [customerId, `gid://shopify/Customer/${customerId}`]
    : [];
  return {
    shop,
    OR: [
      ...(ids.length ? [{ customerId: { in: ids } }] : []),
      ...(customerEmail ? [{ customerEmail }] : []),
    ],
  };
}

export async function createCustomerDataExport(input: {
  shop: string;
  requestId: string;
  customer: CustomerIdentity;
}) {
  const where = customerWhere(input.shop, input.customer);
  const quotes = where.OR.length
    ? await prisma.quote.findMany({
        where,
        include: {
          items: true,
          messages: { include: { attachments: true } },
          attachments: true,
          emailDeliveries: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const payload = {
    generatedAt: new Date().toISOString(),
    shop: input.shop,
    customer: {
      id: String(input.customer.id ?? "") || null,
      email: String(input.customer.email ?? "").trim().toLowerCase() || null,
    },
    quotes,
  };
  return prisma.privacyRequest.upsert({
    where: { id: input.requestId },
    create: {
      id: input.requestId,
      shop: input.shop,
      topic: "customers/data_request",
      customerId: payload.customer.id,
      customerEmail: payload.customer.email,
      payloadJson: JSON.stringify(payload),
    },
    update: { payloadJson: JSON.stringify(payload), status: "READY" },
  });
}

export async function redactCustomerData(input: {
  shop: string;
  customer: CustomerIdentity;
}) {
  const where = customerWhere(input.shop, input.customer);
  if (!where.OR.length) return { deletedQuotes: 0 };
  const quoteIds = (
    await prisma.quote.findMany({ where, select: { id: true } })
  ).map((quote) => quote.id);
  const deleteOperations = [
    ...(quoteIds.length
      ? [
          prisma.quoteReadState.deleteMany({
            where: { shop: input.shop, quoteId: { in: quoteIds } },
          }),
          prisma.quote.deleteMany({ where: { id: { in: quoteIds } } }),
        ]
      : []),
    prisma.privacyRequest.deleteMany({
      where: {
        shop: input.shop,
        OR: [
          ...(input.customer.id != null
            ? [{ customerId: String(input.customer.id) }]
            : []),
          ...(input.customer.email
            ? [{ customerEmail: String(input.customer.email).trim().toLowerCase() }]
            : []),
        ],
      },
    }),
  ];
  await prisma.$transaction(deleteOperations);
  return { deletedQuotes: quoteIds.length };
}

export async function deleteShopData(shop: string) {
  const quoteIds = (
    await prisma.quote.findMany({ where: { shop }, select: { id: true } })
  ).map((quote) => quote.id);

  await prisma.$transaction([
    prisma.quoteReadState.deleteMany({ where: { shop } }),
    prisma.quote.deleteMany({ where: { shop } }),
    prisma.quoteSetting.deleteMany({ where: { shop } }),
    prisma.quotePdfSetting.deleteMany({ where: { shop } }),
    prisma.quoteEmailBranding.deleteMany({ where: { shop } }),
    prisma.shopCounter.deleteMany({ where: { shop } }),
    prisma.privacyRequest.deleteMany({ where: { shop } }),
    prisma.session.deleteMany({ where: { shop } }),
  ]);
  return { deletedQuotes: quoteIds.length };
}
