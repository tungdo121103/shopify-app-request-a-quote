import type { ActionFunctionArgs } from "react-router";
import { handleQuoteConvertAction } from "~/features/quotes/quote-detail-convert-action.server";
import { handleQuoteMessageAction } from "~/features/quotes/quote-detail-message-action.server";
import { handleQuotePricingAction } from "~/features/quotes/quote-detail-pricing-action.server";
import { handleQuoteProductAction } from "~/features/quotes/quote-detail-product-action.server";
import { handleQuoteStatusAction } from "~/features/quotes/quote-detail-status-action.server";
import type {
  QuoteDetailActionContext,
  QuoteDetailActionHandler,
} from "~/features/quotes/quote-detail-action.types";
import { authenticate } from "~/shopify.server";

const actionHandlers: Record<string, QuoteDetailActionHandler> = {
  message: handleQuoteMessageAction,
  add_quote_items: handleQuoteProductAction,
  status: handleQuoteStatusAction,
  convert_order: handleQuoteConvertAction,
};

export async function handleQuoteDetailAction({ request, params }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const context: QuoteDetailActionContext = {
    admin,
    formData,
    quoteId: params.quoteId ?? "",
    request,
    sessionId: session.id,
    shop: session.shop,
  };

  try {
    if (intent === "save_prices" || intent === "send_offer") {
      return await handleQuotePricingAction(context, intent);
    }
    const handler = actionHandlers[intent];
    return handler
      ? await handler(context)
      : { ok: false, error: "Unknown action." };
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
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}
