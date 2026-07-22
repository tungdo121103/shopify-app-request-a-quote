import { addMessage, getQuote, updateQuoteStatus } from "~/models/quote.server";
import type { QuoteDetailActionContext } from "~/features/quotes/quote-detail-action.types";

const validStatuses = [
  "REQUESTED_BY_CUSTOMER",
  "NEGOTIATING",
  "OFFERED_BY_MERCHANT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED_TO_ORDER",
] as const;

export async function handleQuoteStatusAction(context: QuoteDetailActionContext) {
  const status = String(context.formData.get("status") ?? "");
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    return { ok: false, error: "Invalid quote status." };
  }
  const quote = await getQuote(context.shop, context.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  const isReopenRequest = status === "NEGOTIATING";
  const canReopenQuote =
    quote.status === "DECLINED" || String(quote.status) === "EXPIRED";
  const canReviseQuote = quote.status === "OFFERED_BY_MERCHANT";
  if (!isReopenRequest || (!canReopenQuote && !canReviseQuote)) {
    return { ok: false, error: "This quote cannot be reopened or revised." };
  }

  await updateQuoteStatus(context.shop, context.quoteId, status as never);
  await addMessage({
    quoteId: context.quoteId,
    shop: context.shop,
    sender: "MANAGER",
    senderName: "Manager",
    message: canReviseQuote ? "The offer is being revised." : "The quote was reopened.",
    messageType: "SYSTEM",
    eventType: canReviseQuote ? "OFFER_REVISION_STARTED" : "QUOTE_REOPENED",
  });
  return { ok: true, message: "Quote status updated." };
}
