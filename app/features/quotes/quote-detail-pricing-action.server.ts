import { addMessage, getQuote, updateQuotePrices } from "~/models/quote.server";
import type { QuoteDetailActionContext } from "~/features/quotes/quote-detail-action.types";
import { getQuoteEditError } from "~/features/quotes/quote-edit-policy";

function readPrices(formData: FormData) {
  return [...formData.entries()]
    .filter(([key]) => key.startsWith("price:"))
    .map(([key, value]) => {
      const id = key.slice("price:".length);
      return {
        id,
        quotePrice: Number(value),
        quantity: Number(formData.get(`qty:${id}`) ?? 1),
      };
    });
}

export async function handleQuotePricingAction(
  context: QuoteDetailActionContext,
  intent: "save_prices" | "send_offer",
) {
  const quote = await getQuote(context.shop, context.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  const editError = getQuoteEditError(
    quote,
    "Reopen this quote before editing or sending a new offer.",
  );
  if (editError) return { ok: false, error: editError };

  const items = readPrices(context.formData);
  if (items.length === 0) {
    return { ok: false, error: "No quote prices were submitted." };
  }
  const updateResult = await updateQuotePrices({
    quoteId: context.quoteId,
    shop: context.shop,
    items,
    status: intent === "send_offer" ? "OFFERED_BY_MERCHANT" : undefined,
  });

  if (intent === "send_offer") {
    await addMessage({
      quoteId: context.quoteId,
      shop: context.shop,
      sender: "MANAGER",
      senderName: "Manager",
      message: "A new offer was sent.",
      messageType: "SYSTEM",
      eventType: "OFFER_SENT",
    });
  } else if (
    updateResult.quantityChanges.length > 0 ||
    updateResult.priceChanges.length > 0
  ) {
    const quantitiesChanged = updateResult.quantityChanges.length > 0;
    const pricingChanged = updateResult.priceChanges.length > 0;
    await addMessage({
      quoteId: context.quoteId,
      shop: context.shop,
      sender: "MANAGER",
      senderName: "Manager",
      message:
        quantitiesChanged && pricingChanged
          ? "Quote quantities and pricing updated."
          : quantitiesChanged
            ? "Quote quantities updated."
            : "Quote pricing updated.",
      messageType: "SYSTEM",
      eventType:
        quantitiesChanged && pricingChanged
          ? "QUOTE_QUANTITY_AND_PRICE_UPDATED"
          : quantitiesChanged
            ? "QUOTE_QUANTITY_UPDATED"
            : "QUOTE_PRICE_UPDATED",
    });
  }

  return {
    ok: true,
    message:
      intent === "send_offer"
        ? "Offer sent to the customer."
        : "Quote prices saved.",
  };
}
