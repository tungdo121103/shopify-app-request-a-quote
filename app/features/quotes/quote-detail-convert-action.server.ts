import { addMessage, getQuote, markQuoteConverted } from "~/models/quote.server";
import type { QuoteDetailActionContext } from "~/features/quotes/quote-detail-action.types";

export async function handleQuoteConvertAction(context: QuoteDetailActionContext) {
  const quote = await getQuote(context.shop, context.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status !== "ACCEPTED") {
    return {
      ok: false,
      error: "Only an accepted quote can be converted to a Draft Order.",
    };
  }
  if (quote.orderId) {
    return { ok: false, error: "This quote was already converted." };
  }

  const response = await context.admin.graphql(
    `#graphql
      mutation CreateQuoteDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder { id name invoiceUrl }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        input: {
          email: quote.customerEmail || undefined,
          note: [`Created from ${quote.quoteNumber}.`, quote.note || ""]
            .filter(Boolean)
            .join("\n"),
          tags: ["RFQ", quote.quoteNumber],
          customAttributes: [{ key: "Quote ID", value: quote.quoteNumber }],
          lineItems: quote.items.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            originalUnitPrice: item.quotePrice,
            ...(item.sku ? { sku: item.sku } : {}),
          })),
        },
      },
    },
  );
  const result = await response.json();
  const payload = result.data?.draftOrderCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0 || !payload?.draftOrder) {
    return {
      ok: false,
      error:
        userErrors
          .map((error: { message: string }) => error.message)
          .join(" ") || "Shopify could not create the Draft Order.",
    };
  }

  await markQuoteConverted({
    shop: context.shop,
    quoteId: context.quoteId,
    orderId: payload.draftOrder.id,
    orderName: payload.draftOrder.name,
    orderInvoiceUrl: payload.draftOrder.invoiceUrl,
  });
  await addMessage({
    quoteId: context.quoteId,
    shop: context.shop,
    sender: "MANAGER",
    senderName: "Manager",
    message: `Draft Order ${payload.draftOrder.name} was created.`,
    messageType: "SYSTEM",
    eventType: "ORDER_CREATED",
  });

  const shopHandle = context.shop.replace(".myshopify.com", "");
  const draftOrderNumericId = String(payload.draftOrder.id).split("/").pop();
  return {
    ok: true,
    message: `Draft Order ${payload.draftOrder.name} created.`,
    draftOrderAdminUrl: draftOrderNumericId
      ? `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`
      : null,
  };
}
