import type { QuoteEmailTemplateKey } from "~/models/quote-email.shared";

export type QuoteEmailTheme = "clean" | "branded";

export const quoteEmailThemes: Array<{ key: QuoteEmailTheme; label: string; description: string }> = [
  { key: "clean", label: "Clean", description: "Simple white layout for most B2B stores." },
  { key: "branded", label: "Modern Quote", description: "Gradient summary, detailed product table, and prominent actions." },
];

export type QuoteEmailContent = {
  heading: string;
  greeting: string;
  intro: string;
  closing: string;
  signature: string;
  primaryButtonLabel: string;
  acceptButtonLabel: string;
  declineButtonLabel: string;
};

export type QuoteEmailDisplay = {
  showQuoteSummary: boolean;
  showItems: boolean;
  showProductImages: boolean;
  showOriginalPrice: boolean;
  showQuotePrice: boolean;
  showExpiry: boolean;
  showActionButtons: boolean;
  showSku: boolean;
  showVariant: boolean;
  showQuantity: boolean;
  showLineTotal: boolean;
  showQuoteTotals: boolean;
};

export const defaultEmailContent = (key: QuoteEmailTemplateKey): QuoteEmailContent => ({
  heading: ({
    quote_requested: "Your quote request has been submitted",
    negotiation_started: "Negotiation has started",
    offer_sent: "Your customized quote is ready",
    quote_accepted: "Your quote was accepted",
    quote_declined: "Your quote was declined",
    quote_reminder: "Your quote expires soon",
    quote_expired: "Your quote has expired",
    quote_converted: "Your order is ready",
    quote_reopened: "Your quote has been reopened",
  } as Record<QuoteEmailTemplateKey, string>)[key],
  greeting: "Hi {{customerName}},",
  intro: ({
    quote_requested: "Thank you for submitting your quote request to {{shopName}}. Our team will review the details and notify you when an offer is ready.",
    negotiation_started: "The merchant has replied and your quote is now under negotiation.",
    offer_sent: "Your customized quote from {{shopName}} is ready. Please review the pricing and details below.",
    quote_accepted: "Your acceptance has been confirmed. The merchant will review the accepted quote and prepare your order.",
    quote_declined: "Your decision to decline this quote has been recorded.",
    quote_reminder: "Your quote is still awaiting your decision and will expire soon.",
    quote_expired: "This quote has expired and can no longer be accepted or declined.",
    quote_converted: "Your accepted quote from {{shopName}} has been converted to an order.",
    quote_reopened: "The merchant has reopened quote {{quoteNumber}}. You can review it and continue the conversation.",
  } as Record<QuoteEmailTemplateKey, string>)[key],
  closing: key === "quote_requested" || key === "negotiation_started" || key === "quote_reopened" ? "Thank you for working with us." : "Thank you,",
  signature: "Customer service team",
  primaryButtonLabel: key === "quote_converted" ? "View order" : key === "quote_requested" ? "View quote request" : key === "quote_reopened" ? "View reopened quote" : key === "quote_accepted" ? "View quote status" : key === "quote_declined" || key === "quote_expired" ? "View quote details" : "View quote",
  acceptButtonLabel: "Accept quote",
  declineButtonLabel: "Decline quote",
});

export const defaultEmailDisplay = (key: QuoteEmailTemplateKey): QuoteEmailDisplay => ({
  showQuoteSummary: true,
  showItems: key === "quote_requested" || key === "offer_sent",
  showProductImages: true,
  showOriginalPrice: key === "offer_sent",
  showQuotePrice: key === "offer_sent",
  showExpiry: key === "offer_sent" || key === "quote_reminder",
  showActionButtons: key === "offer_sent" || key === "quote_reminder",
  showSku: false,
  showVariant: true,
  showQuantity: true,
  showLineTotal: false,
  showQuoteTotals: key === "offer_sent",
});
