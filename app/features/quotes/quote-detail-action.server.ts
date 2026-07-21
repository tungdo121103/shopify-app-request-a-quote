import type { ActionFunctionArgs } from "react-router";
import {
  requestActorHash,
  requestIpHash,
} from "~/lib/request-identity.server";
import { readMessageAttachments } from "~/lib/quote-message-upload.server";
import {
  addMessage,
  addQuoteItem,
  getQuote,
  markQuoteConverted,
  updateQuotePrices,
  updateQuoteStatus,
} from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

const validStatuses = [
  "REQUESTED_BY_CUSTOMER",
  "NEGOTIATING",
  "OFFERED_BY_MERCHANT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED_TO_ORDER",
] as const;

type AdminProductSearchItem = {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  imageUrl: string;
};

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

export async function handleQuoteDetailAction({ request, params }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const quoteId = params.quoteId ?? "";

  try {
    if (intent === "message") {
      const message = String(formData.get("message") ?? "").trim();
      const attachments = await readMessageAttachments(formData);
      if (!message && attachments.length === 0) {
        return { ok: false, error: "Message or attachment is required." };
      }

      const chatMessage = await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message,
        clientMessageId: String(formData.get("clientMessageId") ?? ""),
        sourceIpHash: requestIpHash(request),
        sourceActorHash: requestActorHash(
          `${session.shop}:manager:${session.id}`,
        ),
        attachments,
      });
      return { ok: true, message: "Message sent.", chatMessage };
    }

    if (intent === "save_prices" || intent === "send_offer") {
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      if (
        quote.status === "OFFERED_BY_MERCHANT" ||
        quote.status === "ACCEPTED" ||
        quote.status === "DECLINED" ||
        String(quote.status) === "EXPIRED" ||
        quote.status === "CONVERTED_TO_ORDER" ||
        quote.orderId
      ) {
        return {
          ok: false,
          error:
            quote.status === "OFFERED_BY_MERCHANT"
              ? "Reopen this quote before editing or sending a new offer."
              : "This quote can no longer be edited.",
        };
      }

      const items = readPrices(formData);
      if (items.length === 0) {
        return { ok: false, error: "No quote prices were submitted." };
      }

      const updateResult = await updateQuotePrices({
        quoteId,
        shop: session.shop,
        items,
        status: intent === "send_offer" ? "OFFERED_BY_MERCHANT" : undefined,
      });

      if (intent === "send_offer") {
        await addMessage({
          quoteId,
          shop: session.shop,
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
          quoteId,
          shop: session.shop,
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

    if (intent === "add_quote_items") {
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      if (
        quote.status === "OFFERED_BY_MERCHANT" ||
        quote.status === "ACCEPTED" ||
        quote.status === "DECLINED" ||
        String(quote.status) === "EXPIRED" ||
        quote.status === "CONVERTED_TO_ORDER" ||
        quote.orderId
      ) {
        return {
          ok: false,
          error:
            quote.status === "OFFERED_BY_MERCHANT"
              ? "Reopen this quote before adding products."
              : "This quote can no longer be edited.",
        };
      }

      const selectedProducts = JSON.parse(
        String(formData.get("selectedProducts") ?? "[]"),
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
        validProducts.map((product) => {
          const unitPrice = Number(product.price);

          return addQuoteItem({
            shop: session.shop,
            quoteId,
            productId: product.productId,
            variantId: product.variantId,
            variantTitle: product.variantTitle,
            title: product.title,
            imageUrl: product.imageUrl,
            sku: product.sku,
            quantity: 1,
            unitPrice,
            quotePrice: unitPrice,
          });
        }),
      );

      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: "Products added to the quote.",
        messageType: "SYSTEM",
        eventType: "QUOTE_PRODUCTS_ADDED",
      });

      return { ok: true, message: "Products added to quote." };
    }

    if (intent === "status") {
      const status = String(formData.get("status") ?? "");
      if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
        return { ok: false, error: "Invalid quote status." };
      }
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      const isReopenRequest = status === "NEGOTIATING";
      const canReopenQuote =
        quote.status === "DECLINED" || String(quote.status) === "EXPIRED";
      const canReviseQuote = quote.status === "OFFERED_BY_MERCHANT";
      if (!isReopenRequest || (!canReopenQuote && !canReviseQuote)) {
        return { ok: false, error: "This quote cannot be reopened or revised." };
      }

      await updateQuoteStatus(
        session.shop,
        quoteId,
        status as never,
      );
      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: canReviseQuote
          ? "The offer is being revised."
          : "The quote was reopened.",
        messageType: "SYSTEM",
        eventType: canReviseQuote ? "OFFER_REVISION_STARTED" : "QUOTE_REOPENED",
      });
      return { ok: true, message: "Quote status updated." };
    }

    if (intent === "convert_order") {
      const quote = await getQuote(session.shop, quoteId);
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

      const response = await admin.graphql(
        `#graphql
          mutation CreateQuoteDraftOrder($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder {
                id
                name
                invoiceUrl
              }
              userErrors {
                field
                message
              }
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
        shop: session.shop,
        quoteId,
        orderId: payload.draftOrder.id,
        orderName: payload.draftOrder.name,
        orderInvoiceUrl: payload.draftOrder.invoiceUrl,
      });

      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: `Draft Order ${payload.draftOrder.name} was created.`,
        messageType: "SYSTEM",
        eventType: "ORDER_CREATED",
      });

      const shopHandle = session.shop.replace(".myshopify.com", "");
      const draftOrderNumericId = String(payload.draftOrder.id)
        .split("/")
        .pop();
      return {
        ok: true,
        message: `Draft Order ${payload.draftOrder.name} created.`,
        draftOrderAdminUrl: draftOrderNumericId
          ? `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`
          : null,
      };
    }

    return { ok: false, error: "Unknown action." };
  } catch (error) {
    if (error instanceof Response) {
      const retryAfter = error.headers.get("Retry-After");
      return new Response(
        JSON.stringify({ ok: false, error: await error.text() }),
        {
          status: error.status,
          headers: {
            "Content-Type": "application/json",
            ...(retryAfter ? { "Retry-After": retryAfter } : {}),
          },
        },
      );
    }
    return {
      ok: false,
      error:
        error instanceof Error
            ? error.message
            : "Something went wrong.",
    };
  }
}

