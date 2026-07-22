import {
  createQuotePdf,
  type PdfQuote,
} from "~/features/pdf/quote-pdf.server";
import { getEmailBranding } from "~/features/email/quote-email.server";
import { getQuotePdfSetting } from "~/models/quote-pdf-setting.server";

type QuotePdfDownload = {
  bytes: Buffer;
  fileName: string;
};

export function getQuotePdfFileName(quoteNumber: string) {
  const safeQuoteNumber = quoteNumber
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeQuoteNumber || "quote"}.pdf`;
}

export async function createQuotePdfDownload(
  shop: string,
  quote: PdfQuote,
): Promise<QuotePdfDownload> {
  const [settings, branding] = await Promise.all([
    getQuotePdfSetting(shop),
    getEmailBranding(shop),
  ]);
  const bytes = await createQuotePdf(quote, settings, {
    logoUrl: branding.logoUrl,
    storeName:
      branding.senderName || shop.replace(/\.myshopify\.com$/i, ""),
  });

  return {
    bytes,
    fileName: getQuotePdfFileName(quote.quoteNumber),
  };
}

export function createQuotePdfDownloadResponse(
  download: QuotePdfDownload,
  cacheControl = "private, no-store",
) {
  return new Response(new Uint8Array(download.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${download.fileName}"`,
      "Cache-Control": cacheControl,
    },
  });
}
