import prisma from "~/db.server";
import { isValidEmail } from "~/lib/contact-validation";
import { sendEmail } from "~/features/email/delivery/email-provider-factory.server";
import { buildQuoteEmailPayload, formatMoney } from "~/features/email/rendering/quote-email-renderer.server";
import type { QuoteEmailContext } from "~/models/quote-email.types";
import type { QuoteEmailTemplateKey } from "~/models/quote-email.shared";

const defaultLocale = "en";

export async function getEmailPreviewItems(shop: string) {
  const quotes = await prisma.quote.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    include: { items: true },
    take: 20,
  });
  const quote = quotes.find((candidate) =>
    candidate.items.some((item) => /^https?:\/\//i.test(item.imageUrl ?? "")),
  ) ?? quotes[0];
  return (quote?.items ?? []).slice(0, 5).map((item) => ({
    name: item.title,
    variant: item.variantTitle ?? "",
    qty: item.quantity,
    original: formatMoney(item.unitPrice.toNumber(), quote?.currency ?? "USD"),
    quote: formatMoney(item.quotePrice.toNumber(), quote?.currency ?? "USD"),
    originalValue: item.unitPrice.toNumber(),
    quoteValue: item.quotePrice.toNumber(),
    currency: quote?.currency ?? "USD",
    imageUrl: /^https?:\/\//i.test(item.imageUrl ?? "") ? item.imageUrl ?? "" : "",
  }));
}

export async function sendTestQuoteEmail(
  shop: string,
  templateKey: QuoteEmailTemplateKey,
  locale: string,
  toEmail: string,
) {
  const recentQuotes = await prisma.quote.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    include: { items: true },
    take: 20,
  });
  const latestQuote = recentQuotes.find((quote) =>
    quote.items.some((item) => /^https?:\/\//i.test(item.imageUrl ?? "")),
  ) ?? recentQuotes[0] ?? null;

  const sampleQuote: QuoteEmailContext = latestQuote ? {
    id: latestQuote.id,
    quoteNumber: latestQuote.quoteNumber,
    customerName: latestQuote.customerName || "Alex Johnson",
    customerEmail: toEmail,
    quoteTotal: latestQuote.quoteTotal.toNumber(),
    originalTotal: latestQuote.originalTotal.toNumber(),
    currency: latestQuote.currency,
    status: String(latestQuote.status),
    note: latestQuote.note,
    expiresAt: latestQuote.expiresAt?.toISOString() ?? null,
    orderInvoiceUrl: latestQuote.orderInvoiceUrl,
    orderName: latestQuote.orderName,
    items: latestQuote.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      quotePrice: item.quotePrice.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      imageUrl: item.imageUrl ?? "",
      sku: item.sku ?? undefined,
      variantTitle: item.variantTitle ?? undefined,
    })),
  } : {
    id: "sample-quote",
    quoteNumber: "RFQ-12345",
    customerName: "Alex Johnson",
    customerEmail: toEmail,
    quoteTotal: 154.92,
    originalTotal: 163.88,
    currency: "USD",
    status: "OFFERED_BY_MERCHANT",
    note: "Please review the quote details and accept or decline.",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      {
        title: "The Collection Snowboard",
        quantity: 3,
        quotePrice: 24.99,
        unitPrice: 29.99,
        imageUrl: "",
        sku: "SNOW-01",
        variantTitle: "Red / Small",
      },
      {
        title: "The 3p Fulfilled Snowboard",
        quantity: 2,
        quotePrice: 12.0,
        unitPrice: 15.0,
        imageUrl: "",
        sku: "SNOW-02",
        variantTitle: "Blue / Medium",
      },
      {
        title: "The Multi-managed Snowboard",
        quantity: 5,
        quotePrice: 10.99,
        unitPrice: 12.99,
        imageUrl: "",
        sku: "SNOW-03",
        variantTitle: "Graph Paper",
      },
    ],
  };

  return sendQuoteNotification({
    shop,
    quote: sampleQuote,
    templateKey,
    locale,
    toEmail,
  });
}

export async function sendQuoteNotification(input: {
  shop: string;
  quote: QuoteEmailContext;
  templateKey: QuoteEmailTemplateKey;
  locale?: string;
  toEmail?: string;
}) {
  const to = input.toEmail ?? input.quote.customerEmail;
  if (!to || !isValidEmail(to)) return false;

  const payload = await buildQuoteEmailPayload({
    shop: input.shop,
    quote: input.quote,
    templateKey: input.templateKey,
    locale: input.locale ?? defaultLocale,
  });

  return sendEmail({
    to,
    subject: payload.subject,
    html: payload.html,
  });
}
