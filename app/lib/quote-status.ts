export const quoteStatusLabels = {
  REQUESTED_BY_CUSTOMER: "Requested by customer",
  NEGOTIATING: "Under negotiation",
  OFFERED_BY_MERCHANT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CONVERTED_TO_ORDER: "Converted to order",
} as const;

export type QuoteStatusValue = keyof typeof quoteStatusLabels;

export function getQuoteStatusLabel(status: string) {
  return (
    quoteStatusLabels[status as QuoteStatusValue] ??
    status.toLowerCase().replaceAll("_", " ")
  );
}

export function getQuoteStatusTone(status: string) {
  switch (status) {
    case "ACCEPTED":
    case "CONVERTED_TO_ORDER":
      return "success";
    case "DECLINED":
      return "critical";
    case "EXPIRED":
      return "neutral";
    case "NEGOTIATING":
    case "OFFERED_BY_MERCHANT":
      return "info";
    default:
      return "warning";
  }
}
