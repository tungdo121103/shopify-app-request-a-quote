import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getQuotePdfSetting,
  updateQuotePdfSetting,
  type QuotePdfSetting,
} from "~/models/quote-pdf-setting.server";
import { getEmailBranding } from "~/features/email/quote-email.server";
import { getLatestQuote } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

export async function loadPdfTemplate({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const [settings, emailBranding, latestQuote] = await Promise.all([
    getQuotePdfSetting(session.shop),
    getEmailBranding(session.shop),
    getLatestQuote(session.shop),
  ]);
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setUTCDate(dueDate.getUTCDate() + 7);

  return {
    settings,
    logoUrl: emailBranding.logoUrl,
    storeName:
      emailBranding.senderName ||
      session.shop.replace(/\.myshopify\.com$/i, "").replace(/[-_]+/g, " "),
    latestQuote: latestQuote
      ? {
          quoteNumber: latestQuote.quoteNumber,
          status: latestQuote.status,
          customerName: latestQuote.customerName,
          customerEmail: latestQuote.customerEmail,
          customerAddress: latestQuote.customerAddress,
          customerRegion: latestQuote.customerRegion,
          customerCountry: latestQuote.customerCountry,
          currency: latestQuote.currency,
          originalTotal: latestQuote.originalTotal,
          quoteTotal: latestQuote.quoteTotal,
          createdAt: latestQuote.createdAt.toISOString(),
          expiresAt: latestQuote.expiresAt?.toISOString() ?? null,
          items: latestQuote.items.map((item) => ({
            id: item.id,
            title: item.title,
            variantTitle: item.variantTitle,
            sku: item.sku,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            quotePrice: item.quotePrice,
          })),
        }
      : null,
    todayIso: today.toISOString().slice(0, 10),
    dueDateIso: dueDate.toISOString().slice(0, 10),
  };
}

export async function savePdfTemplate({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const settings = await updateQuotePdfSetting(session.shop, {
    showQuoteDate: formData.get("showQuoteDate") === "on",
    showDueDate: formData.get("showDueDate") === "on",
    dateFormat: String(formData.get("dateFormat")) as QuotePdfSetting["dateFormat"],
    showOriginalPrice: formData.get("showOriginalPrice") === "on",
    showUnitPrice: formData.get("showUnitPrice") === "on",
    showTotal: formData.get("showTotal") === "on",
    showImage: formData.get("showImage") === "on",
    logoSize: Number(formData.get("logoSize")),
    font: String(formData.get("font")) as QuotePdfSetting["font"],
    fontSize: Number(formData.get("fontSize")),
    primaryColor: String(formData.get("primaryColor")),
    textColor: String(formData.get("textColor")),
    productHeaderColor: String(formData.get("productHeaderColor")),
  });
  return { ok: true, message: "PDF template saved.", settings };
}

export type PdfTemplateData = Awaited<ReturnType<typeof loadPdfTemplate>>;
