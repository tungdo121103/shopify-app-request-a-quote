import type { LoaderFunctionArgs } from "react-router";
import { createQuotePdf } from "~/lib/quote-pdf.server";
import { getEmailBranding } from "~/models/quote-email.server";
import { getQuotePdfSetting } from "~/models/quote-pdf-setting.server";
import { getQuote } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

const safeFileName = (value: string) =>
  value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-");

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [quote, settings, branding] = await Promise.all([
    getQuote(session.shop, params.quoteId ?? ""),
    getQuotePdfSetting(session.shop),
    getEmailBranding(session.shop),
  ]);
  if (!quote) throw new Response("Quote not found", { status: 404 });

  const pdf = await createQuotePdf(quote, settings, {
    logoUrl: branding.logoUrl,
    storeName:
      branding.senderName || session.shop.replace(/\.myshopify\.com$/i, ""),
  });
  const fileName = `${safeFileName(quote.quoteNumber)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
};
