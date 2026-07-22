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
} from "~/models/quote-email-config.shared";
import { getResolvedEmailBranding } from "~/models/quote-email-branding.server";
import { createQuotePortalToken } from "~/features/email/portal/quote-email-token.server";
import { formatQuoteEmailExpiry } from "~/features/email/rendering/quote-email-expiry";
import type { QuoteEmailBranding, QuoteEmailContext } from "~/models/quote-email.types";

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
  const isQuoteReopened = key === "quote_reopened";
  const isActionableQuote = isOfferSent || isQuoteReminder;
  const expiry = display.showExpiry
    ? formatQuoteEmailExpiry(quote.expiresAt)
    : null;
  const showExpiry = expiry !== null;
  const expiryValue = expiry
    ? isQuoteReminder
      ? `<strong>${expiry.statusText}</strong><br><span style="color:#6d7175;font-size:12px">${expiry.dateText}</span>`
      : `<strong>${expiry.dateText}</strong><br><span style="color:#6d7175;font-size:12px">${expiry.statusText}</span>`
    : "";
  const expiryPlainText = expiry
    ? isQuoteReminder
      ? `${expiry.statusText} — ${expiry.dateText}`
      : `${expiry.dateText} — ${expiry.statusText}`
    : "";
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
        : `<table class="modern-summary" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #d9e1e8;border-radius:10px;overflow:hidden"><tr><td colspan="${showExpiry ? 3 : 2}" style="padding:9px 14px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1);color:#202223">Quote Summary</td></tr><tr><td style="padding:16px;text-align:center;vertical-align:top;background:#fff">Quote ID<br><strong>${context.quoteNumber}</strong></td><td style="padding:16px;text-align:center;vertical-align:top;background:#fff">${quoteValueLabel}<br><strong>${context.quoteTotal}</strong></td>${showExpiry ? `<td style="padding:16px;text-align:center;vertical-align:top;background:#fff">Expiry<br>${expiryValue}</td>` : ""}</tr></table>`
      : `<div style="margin:16px 0"><strong>Quote Summary:</strong><br>Quote ID: ${context.quoteNumber}<br>${quoteValueLabel}: ${context.quoteTotal}${showExpiry ? `<br>Expiry: ${expiryPlainText}` : ""}</div>`
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
  const viewQuoteAction = (!branded && !isActionableQuote) || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted || isQuoteReopened
    ? branded
      ? `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto"><tr><td><a href="${primaryActionUrl}" style="display:inline-block;min-width:190px;padding:12px 24px;border:1px solid #b7c0ca;border-radius:8px;background:#f7f8fa;color:#303030!important;text-align:center;text-decoration:none;font-weight:700">${text(content.primaryButtonLabel)}</a></td></tr></table>`
      : `<div style="margin:12px 0 20px">🔍 <a href="${primaryActionUrl}" style="color:${actionColor};font-weight:700;text-decoration:underline">${text(content.primaryButtonLabel)}</a></div>`
    : "";
  const heading = isActionableQuote || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted || isQuoteReopened
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

export function formatMoney(value: number, currency: string) {
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
  const expiry = formatQuoteEmailExpiry(value);
  return expiry ? `${expiry.dateText} — ${expiry.statusText}` : "";
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : fallback;
}
