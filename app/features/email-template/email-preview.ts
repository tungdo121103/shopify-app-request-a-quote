import type {
  getEmailPreviewItems,
  QuoteEmailBranding,
} from "~/features/email/quote-email.server";
import type { QuoteEmailTemplateKey } from "~/models/quote-email.shared";
import type { QuoteEmailContent, QuoteEmailDisplay } from "~/models/quote-email-config.shared";
import {
  createPreviewExpiry,
  formatQuoteEmailExpiry,
} from "~/features/email/rendering/quote-email-expiry";


export function renderStructuredPreview(content: QuoteEmailContent, display: QuoteEmailDisplay, key: QuoteEmailTemplateKey, branding: QuoteEmailBranding, previewItems: Awaited<ReturnType<typeof getEmailPreviewItems>>) {
  const text = (value: string) => renderPreview(escapePreview(value));
  const previewProducts = previewItems.length ? previewItems : fallbackPreviewProducts;
  const originalTotal = previewProducts.reduce((sum, product) => sum + product.originalValue * product.qty, 0);
  const quoteTotal = previewProducts.reduce((sum, product) => sum + product.quoteValue * product.qty, 0);
  const previewCurrency = previewProducts[0]?.currency ?? "USD";
  const originalTotalText = formatPreviewMoney(originalTotal, previewCurrency);
  const quoteTotalText = formatPreviewMoney(quoteTotal, previewCurrency);
  const primaryColor = /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : "#152f7c";
  const linkColor = /^#[0-9a-f]{6}$/i.test(branding.linkColor) ? branding.linkColor : "#1769aa";
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
    ? formatQuoteEmailExpiry(createPreviewExpiry())
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
  const hasCurrentQuoteValue = quoteTotal > 0;
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
        ? `<div style="margin:14px 0;border:1px solid #d9e1e8;border-radius:9px;overflow:hidden"><div style="padding:8px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1)">Quote Summary</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:15px;text-align:center"><span>Quote ID<br><strong>RFQ-99999</strong></span><span>Requested items<br><strong>${previewProducts.length}</strong></span></div></div>`
        : `<div style="margin:14px 0"><strong>Quote Summary:</strong><br>Quote ID: RFQ-99999<br>Requested items: ${previewProducts.length}</div>`
      : isQuoteConverted
      ? branded
        ? `<div style="margin:14px 0;border:1px solid #d9e1e8;border-radius:9px;overflow:hidden"><div style="padding:8px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1)">Order Summary</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:15px;text-align:center"><span>Quote ID<br><strong>RFQ-99999</strong></span><span>Order<br><strong>#1001</strong></span><span>Order Value<br><strong>${quoteTotalText}</strong></span></div></div>`
        : `<div style="margin:14px 0"><strong>Order Summary:</strong><br>Quote ID: RFQ-99999<br>Order: #1001<br>Order Value: ${quoteTotalText}</div>`
      : isNegotiationStarted
      ? branded
        ? `<div style="margin:14px 0;border:1px solid #d9e1e8;border-radius:9px;overflow:hidden"><div style="padding:8px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1)">Quote Summary</div><div style="display:grid;grid-template-columns:repeat(${hasCurrentQuoteValue ? 2 : 1},1fr);gap:8px;padding:15px;text-align:center"><span>Quote ID<br><strong>RFQ-99999</strong></span>${hasCurrentQuoteValue ? `<span>Current Quote Value<br><strong>${quoteTotalText}</strong></span>` : ""}</div></div>`
        : `<div style="margin:14px 0"><strong>Quote Summary:</strong><br>Quote ID: RFQ-99999${hasCurrentQuoteValue ? `<br>Current Quote Value: ${quoteTotalText}` : ""}</div>`
      : branded
      ? isQuoteAccepted
          ? `<div style="margin:14px 0;border:1px solid #d9e1e8;border-radius:9px;overflow:hidden"><div style="padding:8px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1)">Quote Summary</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:15px;text-align:center"><span>Quote ID<br><strong>RFQ-99999</strong></span><span>Accepted Quote Value<br><strong>${quoteTotalText}</strong></span></div></div>`
        : `<div style="margin:14px 0;border:1px solid #d9e1e8;border-radius:9px;overflow:hidden"><div style="padding:8px;text-align:center;font-weight:700;background:linear-gradient(90deg,#a8a5ff,#57dfb1)">Quote Summary</div><div style="display:grid;grid-template-columns:repeat(${showExpiry ? 3 : 2},1fr);gap:8px;padding:15px;text-align:center"><span>Quote ID<br><strong>RFQ-99999</strong></span><span>${quoteValueLabel}<br><strong>${quoteTotalText}</strong></span>${showExpiry ? `<span>Expiry<br>${expiryValue}</span>` : ""}</div></div>`
      : `<div style="margin:14px 0"><strong>Quote Summary:</strong><br>Quote ID: RFQ-99999<br>${quoteValueLabel}: ${quoteTotalText}${showExpiry ? `<br>Expiry: ${expiryPlainText}` : ""}</div>`
    : "";
  const items = display.showItems ? renderPreviewItems(display, previewProducts, branded, originalTotalText, quoteTotalText, true) : "";
  const brand = branding.logoUrl
    ? `<div style="margin:-26px -24px 22px;padding:20px 24px;border-top:4px solid ${branded ? "#65d7e7" : primaryColor};border-bottom:1px solid #e5e7eb;background:#fff;text-align:left"><img src="${escapePreview(branding.logoUrl)}" alt="Store logo" style="max-width:150px;max-height:52px;display:block"></div>`
    : `<div style="height:0;margin:-26px -24px 22px;border-top:4px solid ${branded ? "#65d7e7" : primaryColor}"></div>`;
  const actions = isActionableQuote
    ? branded
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0"><a href="#" style="padding:13px 8px;border:1px solid #b7c0ca;border-radius:10px;background:#f7f8fa;color:#303030;text-align:center;text-decoration:none;font-weight:700">${text(content.primaryButtonLabel)}</a><a href="#" style="padding:13px 8px;border:1px solid #7186d8;border-radius:10px;background:#e4e9ff;color:#203c96;text-align:center;text-decoration:none;font-weight:700">${text(content.acceptButtonLabel)}</a><a href="#" style="padding:13px 8px;border:1px solid #d98799;border-radius:10px;background:#ffe4ea;color:#a52e4b;text-align:center;text-decoration:none;font-weight:700">${text(content.declineButtonLabel)}</a></div>`
      : `<div style="margin:10px 0 18px">🔍 <a href="#" style="color:${linkColor};font-weight:700;text-decoration:underline">${text(content.primaryButtonLabel)}</a><span style="color:#b5b5b5"> &nbsp;|&nbsp; </span>✅ <a href="#" style="color:${linkColor};font-weight:700;text-decoration:underline">${text(content.acceptButtonLabel)}</a><span style="color:#b5b5b5"> &nbsp;|&nbsp; </span>❌ <a href="#" style="color:${linkColor};font-weight:700;text-decoration:underline">${text(content.declineButtonLabel)}</a></div>`
    : "";
  const viewQuoteAction = (!branded && !isActionableQuote) || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted || isQuoteReopened
    ? branded
      ? `<div style="margin:18px 0;text-align:center"><a href="#" style="display:inline-block;min-width:190px;padding:12px 24px;border:1px solid #b7c0ca;border-radius:8px;background:#f7f8fa;color:#303030;text-align:center;text-decoration:none;font-weight:700">${text(content.primaryButtonLabel)}</a></div>`
      : `<div style="margin:12px 0 18px">🔍 <a href="#" style="color:${linkColor};font-weight:700;text-decoration:underline">${text(content.primaryButtonLabel)}</a></div>`
    : "";
  const heading = isActionableQuote || key === "quote_requested" || isNegotiationStarted || isQuoteAccepted || isQuoteDeclined || isQuoteExpired || isQuoteConverted || isQuoteReopened ? "" : `<h2>${text(content.heading)}</h2>`;
  const itemsHeading = display.showItems ? `<p><strong>List items:</strong></p>` : "";
  const actionPrompt = isActionableQuote
    ? `<p>${isQuoteReminder ? "Please review your quote and choose an option before it expires." : "Please review your quote and choose an option:"}</p>`
    : "";
  const negotiationPrompt = isNegotiationStarted
    ? "<p>Please review the latest message and continue the conversation if needed.</p>"
    : "";
  const acceptedPrompt = isQuoteAccepted
    ? "<p>We’ll notify you when your order is ready.</p>"
    : "";
  const declinedPrompt = isQuoteDeclined
    ? "<p>If you would like to revisit this quote, please contact the merchant or continue the conversation.</p>"
    : "";
  const expiredPrompt = isQuoteExpired
    ? "<p>If you are still interested, please contact the merchant or continue the conversation to request a new offer.</p>"
    : "";
  const convertedPrompt = isQuoteConverted
    ? "<p>You can now review your order details and complete the next steps.</p>"
    : "";
  const previewFooter = branding.footerText
    ? `${escapePreview(branding.footerText)}<br>This is an automated email. Please use View quote details to contact the merchant.`
    : "This email was sent regarding quote RFQ-99999.<br>This is an automated email. Please use View quote details to contact the merchant.";
  return `${brand}${heading}<p>${text(content.greeting)}</p><p>${text(content.intro)}</p>${summary}${itemsHeading}${items}${actionPrompt}${actions}${negotiationPrompt}${acceptedPrompt}${declinedPrompt}${expiredPrompt}${convertedPrompt}${viewQuoteAction}<p>${text(content.closing)}</p><p><strong>${text(branding.signature)}</strong></p><p style="color:#6d7175;font-size:11px">${previewFooter}</p>`;
}

function renderPreviewItems(display: QuoteEmailDisplay, products: PreviewProduct[], modern = false, originalTotalText = "$0.00", quoteTotalText = "$0.00", showTotals = true) {
  const rows = products.map((product) => `<tr style="background:#fff">
    ${display.showProductImages ? `<td style="width:64px;padding:8px 10px 8px 0;vertical-align:middle">${product.imageUrl ? `<img src="${escapePreview(product.imageUrl)}" alt="" style="display:block;width:58px;height:58px;object-fit:contain;border-radius:6px">` : `<div style="width:58px;height:58px;border-radius:6px;background:#eef2f5"></div>`}</td>` : ""}
    <td style="padding:8px;vertical-align:middle;overflow-wrap:anywhere"><strong>${product.name}</strong>${display.showVariant && product.variant ? `<br><span style="color:#6d7175;font-size:12px">${product.variant}</span>` : ""}${display.showQuantity ? `<br><span style="color:#6d7175;font-size:12px">Qty: ${product.qty}</span>` : ""}</td>
    ${display.showOriginalPrice || display.showQuotePrice ? `<td style="padding:8px 0 8px 10px;vertical-align:middle;text-align:right;white-space:nowrap;color:#6d7175;font-size:12px">${display.showOriginalPrice ? `<span>Original unit price: ${product.original}</span><br>` : ""}${display.showQuotePrice ? `<strong style="color:#202223">Quoted unit price: ${product.quote}</strong>` : ""}</td>` : ""}
  </tr>`).join("");
  const totals = display.showQuoteTotals && showTotals ? `<table style="width:100%;margin-top:12px"><tr><td>Original subtotal</td><td style="text-align:right">${originalTotalText}</td></tr><tr><td><strong>Quote subtotal</strong></td><td style="text-align:right"><strong>${quoteTotalText}</strong></td></tr></table>` : "";
  if (modern) {
    const modernRows = products.map((product) => `<tr>${display.showProductImages ? `<td style="width:52px;padding:8px;border-bottom:1px solid #e5e7eb">${product.imageUrl ? `<img src="${escapePreview(product.imageUrl)}" alt="" style="display:block;width:44px;height:44px;object-fit:contain">` : ""}</td>` : ""}<td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>${product.name}</strong>${display.showVariant ? `<br><span style="color:#6d7175">${product.variant}</span>` : ""}${display.showQuantity ? `<br><span style="color:#6d7175">Qty: ${product.qty}</span>` : ""}</td>${display.showOriginalPrice ? `<td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;white-space:nowrap">${product.original}</td>` : ""}${display.showQuotePrice ? `<td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-weight:700">${product.quote}</td>` : ""}</tr>`).join("");
    return `<table style="width:100%;border:1px solid #d9e1e8;border-radius:8px;border-collapse:separate;border-spacing:0;margin:14px 0;overflow:hidden"><thead><tr style="background:#f3f5f7;font-size:10px;text-transform:uppercase"><th colspan="${display.showProductImages ? 2 : 1}" style="padding:8px;text-align:left">Product &amp; details</th>${display.showOriginalPrice ? "<th style='padding:8px;text-align:right'>Original unit price</th>" : ""}${display.showQuotePrice ? "<th style='padding:8px;text-align:right'>Quoted unit price</th>" : ""}</tr></thead><tbody>${modernRows}</tbody></table>${totals}`;
  }
  return `<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 8px"><tbody>${rows}</tbody></table>${totals}`;
}

const fallbackPreviewProducts = [
  { name: "The Collection Snowboard", variant: "Red / Small", qty: 3, original: "$29.99", quote: "$24.99", originalValue: 29.99, quoteValue: 24.99, currency: "USD", imageUrl: "" },
  { name: "The 3p Fulfilled Snowboard", variant: "Blue / Medium", qty: 2, original: "$15.00", quote: "$12.00", originalValue: 15, quoteValue: 12, currency: "USD", imageUrl: "" },
];

type PreviewProduct = (typeof fallbackPreviewProducts)[number];

function formatPreviewMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function escapePreview(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPreview(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+=(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/{{\s*customerName\s*}}/g, "Alex Johnson")
    .replace(/{{\s*shopName\s*}}/g, "Vify")
    .replace(/{{\s*quoteNumber\s*}}/g, "RFQ-99999")
    .replace(/{{\s*quoteTotal\s*}}/g, "$154.92")
    .replace(/{{\s*currency\s*}}/g, "USD")
    .replace(
      /{{\s*expiresAt\s*}}/g,
      formatQuoteEmailExpiry(createPreviewExpiry())?.dateText ?? "",
    )
    .replace(/{{\s*quoteUrl\s*}}/g, "#")
    .replace(/{{\s*acceptUrl\s*}}/g, "#")
    .replace(/{{\s*declineUrl\s*}}/g, "#")
    .replace(/{{\s*orderUrl\s*}}/g, "#")
    .replace(/{{\s*invoiceUrl\s*}}/g, "#")
    .replace(/{{\s*orderName\s*}}/g, "#D1001")
    .replace(/{{\s*originalTotal\s*}}/g, "$163.88")
    .replace(/{{\s*status\s*}}/g, "Under negotiation")
    .replace(/{{\s*note\s*}}/g, "Please review the offer details below.")
    .replace(
      /{{\s*items\s*}}/g,
      `<table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:9px 0;border-bottom:1px solid #eee">The Collection Snowboard × 3</td><td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right">$74.97</td></tr>
        <tr><td style="padding:9px 0;border-bottom:1px solid #eee">The 3p Fulfilled Snowboard × 2</td><td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right">$24.00</td></tr>
      </table>`,
    );
}

const commonPlaceholders = [
  "customerName",
  "quoteNumber",
  "quoteTotal",
  "quoteUrl",
];

export const emailTemplateMeta: Record<
  QuoteEmailTemplateKey,
  {
    step: string;
    short: string;
    description: string;
    trigger: string;
    placeholders: string[];
  }
> = {
  quote_requested: {
    step: "1",
    short: "Request confirmation",
    description: "Confirms that the buyer's quote request was received successfully.",
    trigger: "After request",
    placeholders: commonPlaceholders,
  },
  negotiation_started: {
    step: "2",
    short: "First merchant reply",
    description: "Sent once when the merchant starts the negotiation by replying in chat.",
    trigger: "First reply",
    placeholders: commonPlaceholders,
  },
  offer_sent: {
    step: "3",
    short: "Offer ready",
    description: "Invites the buyer to review, accept, or decline the latest offer.",
    trigger: "Offer sent",
    placeholders: [...commonPlaceholders, "expiresAt", "acceptUrl", "declineUrl", "items"],
  },
  quote_accepted: {
    step: "4",
    short: "Acceptance confirmation",
    description: "Confirms that the buyer's acceptance was recorded.",
    trigger: "Buyer accepts",
    placeholders: commonPlaceholders,
  },
  quote_declined: {
    step: "5",
    short: "Decline confirmation",
    description: "Confirms that the buyer declined the current offer.",
    trigger: "Buyer declines",
    placeholders: commonPlaceholders,
  },
  quote_reminder: {
    step: "6",
    short: "Expiry reminder",
    description: "Reminds the buyer before the current offer expires.",
    trigger: "Before expiry",
    placeholders: [...commonPlaceholders, "expiresAt"],
  },
  quote_expired: {
    step: "7",
    short: "Offer expired",
    description: "Lets the buyer know that the offer can no longer be accepted.",
    trigger: "On expiry",
    placeholders: commonPlaceholders,
  },
  quote_converted: {
    step: "8",
    short: "Order created",
    description: "Confirms that the accepted quote was converted to a Shopify Draft Order.",
    trigger: "After conversion",
    placeholders: [...commonPlaceholders, "orderName", "invoiceUrl", "orderUrl"],
  },
  quote_reopened: {
    step: "9",
    short: "Quote reopened",
    description: "Lets the buyer know that a declined or expired quote is open for discussion again.",
    trigger: "Merchant reopens",
    placeholders: commonPlaceholders,
  },
};
