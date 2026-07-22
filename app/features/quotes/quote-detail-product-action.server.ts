import { addMessage, addQuoteItem, getQuote } from "~/models/quote.server";
import type { AdminProductSearchItem } from "~/features/quotes/quote-product.types";
import type { QuoteDetailActionContext } from "~/features/quotes/quote-detail-action.types";
import { getQuoteEditError } from "~/features/quotes/quote-edit-policy";

export async function handleQuoteProductAction(context: QuoteDetailActionContext) {
  const quote = await getQuote(context.shop, context.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  const editError = getQuoteEditError(
    quote,
    "Reopen this quote before adding products.",
  );
  if (editError) return { ok: false, error: editError };

  const selectedProducts = JSON.parse(
    String(context.formData.get("selectedProducts") ?? "[]"),
  ) as AdminProductSearchItem[];
  const validProducts = selectedProducts.filter(
    (product) =>
      product.title?.trim() &&
      Number.isFinite(Number(product.price)) &&
      product.variantId &&
      !quote.items.some(
        (item) =>
          item.variantId === product.variantId ||
          (!!item.productId && item.productId === product.productId),
      ),
  );
  if (validProducts.length === 0) {
    return { ok: false, error: "Please select at least one product." };
  }

  await Promise.all(
    validProducts.map((product) =>
      addQuoteItem({
        shop: context.shop,
        quoteId: context.quoteId,
        productId: product.productId,
        variantId: product.variantId,
        variantTitle: product.variantTitle,
        title: product.title,
        imageUrl: product.imageUrl,
        sku: product.sku,
        quantity: 1,
        unitPrice: Number(product.price),
        quotePrice: Number(product.price),
      }),
    ),
  );
  await addMessage({
    quoteId: context.quoteId,
    shop: context.shop,
    sender: "MANAGER",
    senderName: "Manager",
    message: "Products added to the quote.",
    messageType: "SYSTEM",
    eventType: "QUOTE_PRODUCTS_ADDED",
  });
  return { ok: true, message: "Products added to quote." };
}
