import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "~/db.server";
import {
  defaultEmailPreheaders,
  defaultEmailSubjects,
  type QuoteEmailTemplateKey,
} from "~/models/quote-email.shared";
import {
  defaultEmailContent,
  defaultEmailDisplay,
  type QuoteEmailContent,
  type QuoteEmailDisplay,
  type QuoteEmailTheme,
} from "~/models/quote-email-config.shared";

export { emailTemplateKeys, type QuoteEmailTemplateKey } from "~/models/quote-email.shared";

type QuoteEmailContext = {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string | null;
  quoteTotal: number;
  originalTotal: number;
  currency: string;
  status: string;
  note: string | null;
  expiresAt: string | null;
  orderInvoiceUrl?: string | null;
  orderName?: string | null;
  items: Array<{
    title: string;
    quantity: number;
    quotePrice: number;
    unitPrice: number;
    imageUrl?: string;
    sku?: string;
    variantTitle?: string;
  }>;
};

export type QuoteEmailBranding = {
  senderName: string;
  logoUrl: string;
  primaryColor: string;
  linkColor: string;
  signature: string;
  replyToEmail: string;
  footerText: string;
  theme: QuoteEmailTheme;
};

export type ShopifyEmailIdentity = {
  shopName: string;
  brandLogoUrl: string;
};

const defaultEmailBranding: QuoteEmailBranding = {
  senderName: "",
  logoUrl: "",
  primaryColor: "#152f7c",
  linkColor: "#1769aa",
  signature: "Customer service team",
  replyToEmail: "",
  footerText: "",
  theme: "clean",
};

type QueueQuoteEmailInput = {
  shop: string;
  quote: QuoteEmailContext;
  templateKey: QuoteEmailTemplateKey;
  idempotencyKey: string;
  locale?: string;
};

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
  return {
    sendGridConfigured: Boolean(
      process.env.SENDGRID_API_KEY?.trim() &&
        process.env.SENDGRID_FROM_EMAIL?.trim(),
    ),
    fromEmail: process.env.SENDGRID_FROM_EMAIL?.trim() || null,
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

export async function buildQuoteEmailPayload(input: {
  shop: string;
  quote: QuoteEmailContext;
  templateKey: QuoteEmailTemplateKey;
  locale?: string;
}) {
  const branding = await getResolvedEmailBranding(input.shop);
  const context = {
    ...buildTemplateContext(input.shop, input.quote),
    shopName: branding.senderName || input.shop.replace(/\.myshopify\.com$/i, ""),
  };
  return {
    subject: renderTemplate(defaultEmailSubjects[input.templateKey], context),
    html: renderEmailDocument(
      renderStructuredTemplate({ ...defaultEmailContent(input.templateKey), signature: branding.signature }, defaultEmailDisplay(input.templateKey), context, input.templateKey, input.quote, branding),
      branding,
      context,
      renderTemplate(defaultEmailPreheaders[input.templateKey], context),
    ),
  };
}

export async function getEmailBranding(shop: string): Promise<QuoteEmailBranding> {
  const row = await prisma.quoteEmailBranding.findUnique({ where: { shop } });
  const branding = { ...defaultEmailBranding, ...(row ?? {}) };
  return { ...branding, theme: branding.theme === "branded" ? "branded" : "clean" };
}

const storefrontIdentityCache = new Map<
  string,
  { expiresAt: number; value: ShopifyEmailIdentity }
>();

/**
 * Brand settings are public storefront data. Some shops don't configure Brand,
 * so every field is optional and failures deliberately fall through to stored
 * email branding.
 */
export async function getShopifyStorefrontIdentity(
  shop: string,
): Promise<ShopifyEmailIdentity> {
  const cached = storefrontIdentityCache.get(shop);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fallback: ShopifyEmailIdentity = { shopName: "", brandLogoUrl: "" };
  try {
    const response = await fetch(`https://${shop}/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query EmailStorefrontBrand {
          shop {
            name
            brand {
              logo { image { url } }
              squareLogo { image { url } }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Storefront API returned ${response.status}`);
    const result = await response.json() as {
      data?: {
        shop?: {
          name?: string | null;
          brand?: {
            logo?: { image?: { url?: string | null } | null } | null;
            squareLogo?: { image?: { url?: string | null } | null } | null;
          } | null;
        };
      };
      errors?: unknown[];
    };
    const value = {
      shopName: String(result.data?.shop?.name ?? "").trim(),
      brandLogoUrl: safeHttpUrl(
        String(
          result.data?.shop?.brand?.logo?.image?.url ??
            result.data?.shop?.brand?.squareLogo?.image?.url ??
            "",
        ),
      ),
    };
    storefrontIdentityCache.set(shop, {
      value,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return value;
  } catch (error) {
    console.warn("Unable to read Shopify Storefront brand identity", { shop, error });
    storefrontIdentityCache.set(shop, {
      value: fallback,
      expiresAt: Date.now() + 60 * 1000,
    });
    return fallback;
  }
}

export async function getResolvedEmailBranding(
  shop: string,
  identityOverride?: Partial<ShopifyEmailIdentity>,
): Promise<QuoteEmailBranding> {
  const [stored, storefrontIdentity] = await Promise.all([
    getEmailBranding(shop),
    getShopifyStorefrontIdentity(shop),
  ]);
  const identity = { ...storefrontIdentity, ...identityOverride };
  return {
    ...stored,
    senderName:
      String(identity.shopName ?? "").trim() ||
      stored.senderName ||
      shop.replace(/\.myshopify\.com$/i, "").replace(/[-_]+/g, " "),
    // Shopify Brand is authoritative. The saved logo is a merchant fallback.
    logoUrl: safeHttpUrl(identity.brandLogoUrl ?? "") || stored.logoUrl,
  };
}

export async function updateEmailBranding(shop: string, input: QuoteEmailBranding) {
  const branding = {
    senderName: String(input.senderName ?? "").trim().slice(0, 120),
    logoUrl: safeHttpUrl(input.logoUrl),
    primaryColor: safeColor(input.primaryColor, defaultEmailBranding.primaryColor),
    linkColor: safeColor(input.linkColor, defaultEmailBranding.linkColor),
    signature: String(input.signature ?? "").trim().slice(0, 200),
    replyToEmail: isValidEmail(input.replyToEmail) ? input.replyToEmail.trim() : "",
    footerText: String(input.footerText ?? "").trim().slice(0, 500),
    theme: input.theme === "branded" ? "branded" : "clean",
  };
  await prisma.quoteEmailBranding.upsert({
    where: { shop },
    create: { id: `quote-email-branding-${shop}`, shop, ...branding },
    update: branding,
  });
  return branding;
}

function renderStructuredTemplate(
  content: QuoteEmailContent,
  display: QuoteEmailDisplay,
  context: Record<string, string>,
  key: QuoteEmailTemplateKey,
  quote: QuoteEmailContext,
  branding: QuoteEmailBranding,
) {
  const text = (value: string) => renderTemplate(escapeHtml(value), context);
  const branded = branding.theme === "branded";
  const isOfferSent = key === "offer_sent";
  const isNegotiationStarted = key === "negotiation_started";
  const isQuoteAccepted = key === "quote_accepted";
  const isQuoteDeclined = key === "quote_declined";
  const isQuoteReminder = key === "quote_reminder";
  const isQuoteExpired = key === "quote_expired";
  const isQuoteConverted = key === "quote_converted";
  const isActionableQuote = isOfferSent || isQuoteReminder;
  const hasCurrentQuoteValue = Number(quote.quoteTotal) > 0;
  const quoteValueLabel = isOfferSent
    ? "Total Quote Value"
    : isQuoteAccepted
      ? "Accepted Quote Value"
      : isQuoteDeclined
        ? "Declined Quote Value"
      : isQuoteReminder
        ? "Current Quote Value"
      : isQuoteExpired
        ? "Expired Quote Value"
      : "Quote Value";
  const summary = display.showQuoteSummary
    ? key === "quote_requested"
      ? branded
        ? `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="2" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Quote Summary</td></tr><tr><td style="padding:16px;text-align:center;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td><td style="padding:16px;text-align:center;background:#fff">Requested items<br><strong>${quote.items.length}</strong></td></tr></table>`
        : `<div style="margin:16px 0"><strong>Quote Summary:</strong><br>Quote ID: ${context.quoteNumber}<br>Requested items: ${quote.items.length}</div>`
      : isQuoteConverted
      ? branded
        ? `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="${context.orderName ? 3 : 2}" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Order Summary</td></tr><tr><td style="padding:16px;text-align:center;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td>${context.orderName ? `<td style="padding:16px;text-align:center;background:#fff">Order<br><strong>${context.orderName}</strong></td>` : ""}<td style="padding:16px;text-align:center;background:#fff">Order Value<br><strong>${context.quoteTotal}</strong></td></tr></table>`
        : `<div style="margin:16px 0"><strong>Order Summary:</strong><br>Quote ID: ${context.quoteNumber}${context.orderName ? `<br>Order: ${context.orderName}` : ""}<br>Order Value: ${context.quoteTotal}</div>`
      : isNegotiationStarted
      ? branded
        ? `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="${hasCurrentQuoteValue ? 2 : 1}" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Quote Summary</td></tr><tr><td style="padding:16px;text-align:center;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td>${hasCurrentQuoteValue ? `<td style="padding:16px;text-align:center;background:#fff">Current Quote Value<br><strong>${context.quoteTotal}</strong></td>` : ""}</tr></table>`
        : `<div style="margin:16px 0"><strong>Quote Summary:</strong><br>Quote ID: ${context.quoteNumber}${hasCurrentQuoteValue ? `<br>Current Quote Value: ${context.quoteTotal}` : ""}</div>`
      : branded
      ? isQuoteAccepted
          ? `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="2" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Quote Summary</td></tr><tr><td style="padding:16px;text-align:center;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td><td style="padding:16px;text-align:center;background:#fff">Accepted Quote Value<br><strong>${context.quoteTotal}</strong></td></tr></table>`
        : `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="${display.showExpiry ? 3 : 2}" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Quote Summary</td></tr><tr><td style="padding:16px;text-align:center;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td><td style="padding:16px;text-align:center;background:#fff">${quoteValueLabel}<br><strong>${context.quoteTotal}</strong></td>${display.showExpiry ? `<td style="padding:16px;text-align:center;background:#fff">Expiry<br><strong>${context.expiryText}</strong></td>` : ""}</tr></table>`
      : `<div style="margin:16px 0"><strong>Quote Summary:</strong><br>Quote ID: ${context.quoteNumber}<br>${quoteValueLabel}: ${context.quoteTotal}${display.showExpiry ? `<br>${context.expiryText}` : ""}</div>`
    : "";
  const items = display.showItems
    ? branded
      ? renderModernQuoteItemsHtml(quote.items, quote.currency, display)
      : renderQuoteItemsHtml(quote.items, quote.currency, display)
    : "";
  const totals = display.showItems && display.showQuoteTotals
    ? renderQuoteTotalsHtml(quote, quote.currency)
    : "";
  const actionColor = safeColor(branding.linkColor, "#1769aa");
  const primaryActionUrl = key === "quote_converted" ? context.orderUrl : context.quoteUrl;
  const actions = isActionableQuote && display.showActionButtons
    ? branded
      ? `<table class="email-actions" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0"><tr><td style="width:33.33%;padding-right:5px"><a class="email-primary-action" href="${context.quoteUrl}" style="display:block;padding:14px 8px;border:1px solid #b7c0ca;border-radius:10px;background:#f7f8fa;color:#303030!important;text-decoration:none;text-align:center;font-weight:700">${text(content.primaryButtonLabel)}</a></td><td style="width:33.33%;padding:0 5px"><a class="email-primary-action" href="${context.acceptUrl}" style="display:block;padding:14px 8px;border:1px solid #7186d8;border-radius:10px;background:#e4e9ff;color:#203c96!important;text-decoration:none;text-align:center;font-weight:700">${text(content.acceptButtonLabel)}</a></td><td style="width:33.33%;padding-left:5px"><a class="email-secondary-action" href="${context.declineUrl}" style="display:block;padding:14px 8px;border:1px solid #d98799;border-radius:10px;background:#ffe4ea;color:#a52e4b!important;text-decoration:none;text-align:center;font-weight:700">${text(content.declineButtonLabel)}</a></td></tr></table>`
      : `<div class="email-actions" style="margin:10px 0 20px">🔍 <a href="${context.quoteUrl}" style="color:${actionColor};font-weight:700;text-decoration:underline">${text(content.primaryButtonLabel)}</a><span style="color:#b5b5b5"> &nbsp;|&nbsp; </span>✅ <a href="${context.acceptUrl}" style="color:${actionColor};font-weight:700;text-decoration:underline">${text(content.acceptButtonLabel)}</a><span style="color:#b5b5b5"> &nbsp;|&nbsp; </span>❌ <a href="${context.declineUrl}" style="color:${actionColor};font-weight:700;text-decoration:underline">${text(content.declineButtonLabel)}</a></div>`
    : "";
  const viewQuoteAction = (!branded && !isActionableQuote) || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted
    ? branded
      ? `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto"><tr><td><a href="${primaryActionUrl}" style="display:inline-block;min-width:190px;padding:12px 24px;border:1px solid #b7c0ca;border-radius:8px;background:#f7f8fa;color:#303030!important;text-align:center;text-decoration:none;font-weight:700">${text(content.primaryButtonLabel)}</a></td></tr></table>`
      : `<div style="margin:12px 0 20px">🔍 <a href="${primaryActionUrl}" style="color:${actionColor};font-weight:700;text-decoration:underline">${text(content.primaryButtonLabel)}</a></div>`
    : "";
  const heading = isActionableQuote || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted
    ? ""
    : `<h1 style="margin:0 0 14px;color:#202223;font-size:22px;line-height:1.3">${text(content.heading)}</h1>`;
  const itemsHeading = display.showItems
    ? `<p style="margin:18px 0 8px"><strong>List items:</strong></p>`
    : "";
  const actionPrompt = isActionableQuote && display.showActionButtons
    ? `<p style="margin:18px 0 8px">${isQuoteReminder ? "Please review your quote and choose an option before it expires." : "Please review your quote and choose an option:"}</p>`
    : "";
  const negotiationPrompt = isNegotiationStarted
    ? '<p style="margin:18px 0 8px">Please review the latest message and continue the conversation if needed.</p>'
    : "";
  const acceptedPrompt = isQuoteAccepted
    ? '<p style="margin:18px 0 8px">We’ll notify you when your order is ready.</p>'
    : "";
  const declinedPrompt = isQuoteDeclined
    ? '<p style="margin:18px 0 8px">If you would like to revisit this quote, please contact the merchant or continue the conversation.</p>'
    : "";
  const expiredPrompt = isQuoteExpired
    ? '<p style="margin:18px 0 8px">If you are still interested, please contact the merchant or continue the conversation to request a new offer.</p>'
    : "";
  const convertedPrompt = isQuoteConverted
    ? '<p style="margin:18px 0 8px">You can now review your order details and complete the next steps.</p>'
    : "";
  return `${heading}<p>${text(content.greeting)}</p><p>${text(content.intro)}</p>${summary}${itemsHeading}${items}${totals}${actionPrompt}${actions}${negotiationPrompt}${acceptedPrompt}${declinedPrompt}${expiredPrompt}${convertedPrompt}${viewQuoteAction}<p>${text(content.closing)}</p><p><strong>${text(content.signature)}</strong></p>`;
}

function renderEmailDocument(
  contentHtml: string,
  branding: QuoteEmailBranding,
  context: Record<string, string>,
  preheader: string,
) {
  const primaryColor = safeColor(branding.primaryColor, "#152f7c");
  const isBranded = branding.theme === "branded";
  const headerBackground = "#ffffff";
  const logoHeader = branding.logoUrl
    ? `<tr><td class="email-pad" style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:${headerBackground};text-align:left">
        <img src="${escapeHtml(optimizedEmailImageUrl(branding.logoUrl, 300))}" alt="${escapeHtml(context.shopName || "Shop")}" style="display:block;max-width:150px;max-height:52px">
      </td></tr>`
    : "";
  const styledContent = contentHtml
    .replace(/<p>/gi, '<p style="margin:0 0 14px">');
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@media only screen and (max-width:600px){
  .email-outer{padding:10px 4px!important}
  .email-shell{width:100%!important;max-width:100%!important}
  .email-pad{padding:18px 14px!important}
  .item-row{display:block!important;width:100%!important;margin-bottom:12px!important;border:1px solid #e5e7eb!important;border-radius:8px!important}
  .clean-products .item-row{border:0!important;border-radius:0!important}
  .item-row td{display:block!important;box-sizing:border-box!important;width:100%!important;border:0!important;text-align:left!important;white-space:normal!important}
  .item-image-cell{padding:12px 12px 0!important}
  .item-image{width:58px!important;height:58px!important}
  .item-info{padding:8px 12px!important;overflow-wrap:anywhere!important}
  .item-prices{padding:0 12px 12px!important;line-height:1.65!important}
  .mobile-hide{display:none!important}
  .modern-products thead{display:none!important}
  .modern-products,.modern-products tbody{display:block!important;width:100%!important}
  .modern-products .item-row{display:grid!important;grid-template-columns:76px minmax(0,1fr)!important}
  .modern-products .item-row td{display:block!important;width:auto!important}
  .modern-products .item-prices{grid-column:1/-1!important;padding:10px 12px!important;border-top:1px solid #e5e7eb!important}
  .modern-summary td{font-size:12px!important}
  .email-actions{margin-top:18px!important}
  .email-actions td{display:block!important;box-sizing:border-box!important;width:100%!important;padding:5px 0!important}
  .email-primary-action,.email-secondary-action{display:block!important;box-sizing:border-box!important;width:100%!important;margin:8px 0!important;text-align:center!important}
  h1{font-size:20px!important}
}
</style></head><body style="margin:0;padding:0;background:#eef2f5;color:#202223;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table class="email-outer" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f5;padding:24px 10px">
    <tr><td align="center">
      <table class="email-shell" role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d9e1e8;border-top:${isBranded ? "4px solid #65d7e7" : `4px solid ${primaryColor}`};border-radius:10px;overflow:hidden">
        ${logoHeader}
        <tr><td class="email-pad" style="padding:26px 28px;color:#303030;font-size:14px;line-height:1.55">${styledContent}</td></tr>
        <tr><td class="email-pad" style="padding:16px 28px;background:#f7f8fa;border-top:1px solid #e5e7eb;color:#6d7175;font-size:11px;line-height:1.5">
          ${branding.footerText
            ? `${escapeHtml(renderTemplate(branding.footerText, context))}<br>`
            : `This email was sent regarding quote ${escapeHtml(context.quoteNumber)}.<br>`}
          This is an automated email. Please use View quote details to contact the merchant.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTemplateContext(shop: string, quote: QuoteEmailContext) {
  const portalToken = createQuotePortalToken(shop, quote.id);
  const quoteUrl = quote.id === "sample-quote"
    ? "#"
    : `https://${shop}/?sp_quote=${encodeURIComponent(quote.id)}&sp_token=${encodeURIComponent(portalToken)}`;
  const acceptUrl = quoteUrl === "#" ? "#" : `${quoteUrl}&sp_action=ACCEPTED`;
  const declineUrl = quoteUrl === "#" ? "#" : `${quoteUrl}&sp_action=DECLINED`;
  const orderUrl = quote.orderInvoiceUrl || quoteUrl;

  return {
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName || "Customer",
    customerEmail: quote.customerEmail ?? "",
    quoteTotal: formatMoney(quote.quoteTotal, quote.currency),
    originalTotal: formatMoney(quote.originalTotal, quote.currency),
    currency: quote.currency,
    status: quote.status,
    note: quote.note ?? "",
    expiresAt: quote.expiresAt ? formatDate(quote.expiresAt) : "N/A",
    expiryText: formatExpiryText(quote.expiresAt),
    quoteUrl,
    acceptUrl,
    declineUrl,
    orderUrl,
    invoiceUrl: quote.orderInvoiceUrl || "",
    orderName: quote.orderName || "",
    items: renderQuoteItemsHtml(quote.items, quote.currency),
  };
}

export function createQuotePortalToken(shop: string, quoteId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const payload = `${shop}:${quoteId}:${expiresAt}`;
  const signature = createHmac("sha256", quotePortalSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyQuotePortalToken(token: string, shop: string, quoteId: string) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    const signature = parts.pop() ?? "";
    const expiresAt = Number(parts.pop());
    const tokenQuoteId = parts.pop() ?? "";
    const tokenShop = parts.join(":");
    if (tokenShop !== shop || tokenQuoteId !== quoteId || expiresAt < Date.now() / 1000) {
      return false;
    }
    const expected = createHmac("sha256", quotePortalSecret())
      .update(`${tokenShop}:${tokenQuoteId}:${expiresAt}`)
      .digest();
    const provided = Buffer.from(signature, "base64url");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

function quotePortalSecret() {
  const secret = process.env.QUOTE_PORTAL_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") {
    return "sp-rfq-development-only-portal-secret";
  }
  if (!secret) throw new Error("QUOTE_PORTAL_SECRET is not configured.");
  return secret;
}

function renderQuoteItemsHtml(
  items: QuoteEmailContext["items"],
  currency: string,
  display: Pick<QuoteEmailDisplay, "showProductImages" | "showOriginalPrice" | "showQuotePrice" | "showSku" | "showVariant" | "showQuantity" | "showLineTotal"> = {
    showProductImages: true,
    showOriginalPrice: true,
    showQuotePrice: true,
    showSku: true,
    showVariant: true,
    showQuantity: true,
    showLineTotal: true,
  },
) {
  if (!items.length) {
    return "<p>No quote items available.</p>";
  }

  return `
    <table class="clean-products" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
      <tbody>
        ${items
          .map(
            (item) => `
            <tr class="item-row" style="background:#ffffff">
              ${display.showProductImages ? `<td class="item-image-cell" style="width:64px;padding:8px 10px 8px 0;vertical-align:middle">
                ${item.imageUrl ? `<img class="item-image" src="${escapeHtml(optimizedEmailImageUrl(item.imageUrl, 160))}" alt="" width="58" height="58" style="display:block;width:58px;height:58px;object-fit:contain;border-radius:6px">` : `<div class="item-image" style="width:58px;height:58px;border-radius:6px;background:#eef2f5"></div>`}
              </td>` : ""}
              <td class="item-info" style="padding:8px;vertical-align:middle;overflow-wrap:anywhere;">
                <strong style="color:#202223">${escapeHtml(item.title)}</strong><br>
                ${display.showVariant && item.variantTitle ? `<span style="color:#6d7175;font-size:12px">${escapeHtml(item.variantTitle)}</span><br>` : ""}
                ${display.showQuantity ? `<span style="color:#6d7175;font-size:12px">Qty: ${item.quantity}</span>` : ""}
              </td>
              ${display.showOriginalPrice || display.showQuotePrice || display.showLineTotal ? `<td class="item-prices" style="padding:8px 0 8px 10px;vertical-align:middle;text-align:right;white-space:nowrap;color:#6d7175;font-size:12px">
                ${display.showOriginalPrice ? `<span class="mobile-hide">Original unit price: ${formatMoney(item.unitPrice, currency)}<br></span>` : ""}
                ${display.showQuotePrice ? `<strong style="color:#202223">Quoted unit price: ${formatMoney(item.quotePrice, currency)}</strong><br>` : ""}
                ${display.showLineTotal ? `<span style="color:#6d7175">Line total: ${formatMoney(item.quotePrice * item.quantity, currency)}</span>` : ""}
              </td>` : ""}
            </tr>
          `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderQuoteTotalsHtml(quote: QuoteEmailContext, currency: string) {
  return `<table role="presentation" width="100%" style="margin:12px 0 20px;border-collapse:collapse"><tr><td style="padding:4px 0;color:#6d7175">Original subtotal</td><td style="padding:4px 0;text-align:right">${formatMoney(quote.originalTotal, currency)}</td></tr><tr><td style="padding:4px 0;font-weight:700">Quote subtotal</td><td style="padding:4px 0;text-align:right;font-weight:700">${formatMoney(quote.quoteTotal, currency)}</td></tr></table>`;
}

function renderModernQuoteItemsHtml(
  items: QuoteEmailContext["items"],
  currency: string,
  display: QuoteEmailDisplay,
) {
  if (!items.length) return "<p>No quote items available.</p>";

  return `<table class="modern-products" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">
    <thead><tr style="background:#f3f5f7;color:#303030;font-size:11px;text-transform:uppercase">
      <th colspan="${display.showProductImages ? 2 : 1}" style="padding:9px;text-align:left;border-bottom:1px solid #d9e1e8">Product &amp; details</th>
      ${display.showOriginalPrice ? '<th style="padding:9px;text-align:right;border-bottom:1px solid #d9e1e8;white-space:nowrap">Original unit price</th>' : ""}
      ${display.showQuotePrice ? '<th style="padding:9px;text-align:right;border-bottom:1px solid #d9e1e8;white-space:nowrap">Quoted unit price</th>' : ""}
    </tr></thead><tbody>${items.map((item) => `<tr class="item-row">
      ${display.showProductImages ? `<td class="item-image-cell" style="padding:10px;text-align:center;border-bottom:1px solid #e5e7eb">${item.imageUrl ? `<img class="item-image" src="${escapeHtml(optimizedEmailImageUrl(item.imageUrl, 160))}" alt="" width="58" height="58" style="display:inline-block;width:58px;height:58px;object-fit:contain;border-radius:6px">` : '<div class="item-image" style="display:inline-block;width:58px;height:58px;border-radius:6px;background:#eef2f5"></div>'}</td>` : ""}
      <td class="item-info" style="padding:10px;border-bottom:1px solid #e5e7eb;overflow-wrap:anywhere"><strong>${escapeHtml(item.title)}</strong>${display.showVariant && item.variantTitle ? `<br><span style="color:#6d7175;font-size:12px">${escapeHtml(item.variantTitle)}</span>` : ""}${display.showQuantity ? `<br><span style="color:#6d7175;font-size:12px">Qty: ${item.quantity}</span>` : ""}</td>
      ${display.showOriginalPrice ? `<td class="item-prices" style="padding:10px;text-align:right;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6d7175">${formatMoney(item.unitPrice, currency)}</td>` : ""}
      ${display.showQuotePrice ? `<td class="item-prices" style="padding:10px;text-align:right;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-weight:700">${formatMoney(item.quotePrice, currency)}</td>` : ""}
    </tr>`).join("")}</tbody>
  </table>`;
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    return String(values[key] ?? "");
  });
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function optimizedEmailImageUrl(value: string, width: number) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:") url.protocol = "https:";
    if (
      url.hostname === "cdn.shopify.com" ||
      url.hostname.endsWith(".myshopify.com")
    ) {
      url.searchParams.set("width", String(width));
    }
    return url.toString();
  } catch {
    return value;
  }
}

function formatExpiryText(value: string | null) {
  if (!value) return "No expiry date";
  const expiry = new Date(value);
  const days = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86_400_000));
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(expiry);
  return `Expires in ${days} day(s), on ${date}`;
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : fallback;
}

function safeHttpUrl(value: string) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url.slice(0, 1000) : "";
  } catch {
    return "";
  }
}

class EmailProviderError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "EmailProviderError";
    this.retryable = retryable;
  }
}

async function sendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  const fromName = process.env.SENDGRID_FROM_NAME?.trim();
  const replyTo = process.env.SENDGRID_REPLY_TO?.trim();

  if (!apiKey || !fromEmail) {
    throw new EmailProviderError(
      "SendGrid is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.",
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
        from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        content: [
          { type: "text/plain", value: htmlToPlainText(input.html) },
          { type: "text/html", value: input.html },
        ],
      }),
    });
  } catch (error) {
    throw new EmailProviderError(
      `SendGrid request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
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

function htmlToPlainText(html: string) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
