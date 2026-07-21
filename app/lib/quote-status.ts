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

const allowedQuoteStatusTransitions: Record<
  QuoteStatusValue,
  readonly QuoteStatusValue[]
> = {
  REQUESTED_BY_CUSTOMER: ["NEGOTIATING"],
  NEGOTIATING: ["OFFERED_BY_MERCHANT"],
  OFFERED_BY_MERCHANT: ["NEGOTIATING", "ACCEPTED", "DECLINED", "EXPIRED"],
  ACCEPTED: ["CONVERTED_TO_ORDER"],
  DECLINED: ["NEGOTIATING"],
  EXPIRED: ["NEGOTIATING"],
  CONVERTED_TO_ORDER: [],
};

export function canTransitionQuoteStatus(
  current: QuoteStatusValue,
  next: QuoteStatusValue,
) {
  return (
    current === next || allowedQuoteStatusTransitions[current].includes(next)
  );
}

export function assertQuoteStatusTransition(
  current: QuoteStatusValue,
  next: QuoteStatusValue,
) {
  if (canTransitionQuoteStatus(current, next)) return;

  throw new Response(
    `Quote status cannot change from ${getQuoteStatusLabel(current)} to ${getQuoteStatusLabel(next)}.`,
    { status: 409 },
  );
}

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

export function shouldShowQuoteDueDate(
  status: string | null | undefined,
  expiresAt: string | Date | null | undefined,
) {
  return Boolean(
    expiresAt &&
      (status === "OFFERED_BY_MERCHANT" || status === "EXPIRED"),
  );
}
