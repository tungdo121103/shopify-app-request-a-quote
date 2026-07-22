type EditableQuote = {
  orderId?: string | null;
  status?: string | null;
};

export function getQuoteEditError(
  quote: EditableQuote,
  offeredMessage: string,
) {
  if (quote.status === "OFFERED_BY_MERCHANT") return offeredMessage;
  if (
    quote.status === "ACCEPTED" ||
    quote.status === "DECLINED" ||
    quote.status === "EXPIRED" ||
    quote.status === "CONVERTED_TO_ORDER" ||
    quote.orderId
  ) {
    return "This quote can no longer be edited.";
  }
  return null;
}
