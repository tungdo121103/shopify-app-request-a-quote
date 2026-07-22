import type { QuoteEmailTemplateKey } from "~/models/quote-email.shared";
import type { QuoteEmailTheme } from "~/models/quote-email-config.shared";

export type QuoteEmailContext = {
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

export type QueueQuoteEmailInput = {
  shop: string;
  quote: QuoteEmailContext;
  templateKey: QuoteEmailTemplateKey;
  idempotencyKey: string;
  locale?: string;
};
