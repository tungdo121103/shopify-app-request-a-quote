export const emailTemplateKeys = [
  "quote_requested",
  "negotiation_started",
  "offer_sent",
  "quote_accepted",
  "quote_declined",
  "quote_reminder",
  "quote_expired",
  "quote_converted",
] as const;

export type QuoteEmailTemplateKey = (typeof emailTemplateKeys)[number];

export const emailTemplateLabels: Record<QuoteEmailTemplateKey, string> = {
  quote_requested: "Quote request received",
  offer_sent: "Offer sent",
  negotiation_started: "Negotiation started",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  quote_reminder: "Quote reminder",
  quote_expired: "Quote expired",
  quote_converted: "Quote converted",
};

export const defaultEmailSubjects: Record<QuoteEmailTemplateKey, string> = {
  quote_requested: "We've received your quote request",
  negotiation_started: "Negotiation started for your quote",
  offer_sent: "Your quote is ready for review",
  quote_accepted: "Acceptance confirmed for quote {{quoteNumber}}",
  quote_declined: "Decline confirmed for quote {{quoteNumber}}",
  quote_reminder: "Reminder: Quote {{quoteNumber}} expires soon",
  quote_expired: "Quote {{quoteNumber}} has expired",
  quote_converted: "Quote {{quoteNumber}} has been converted to an order",
};

export const defaultEmailPreheaders: Record<QuoteEmailTemplateKey, string> = {
  quote_requested: "We’ve received your quote request.",
  negotiation_started: "The merchant has sent a new reply.",
  offer_sent: "Review your customized pricing and respond.",
  quote_accepted: "Your acceptance has been recorded.",
  quote_declined: "Your decision has been recorded.",
  quote_reminder: "Your quote will expire soon.",
  quote_expired: "This quote can no longer be accepted.",
  quote_converted: "Your order is ready to review.",
};
