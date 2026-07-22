import type { ActionFunctionArgs } from "react-router";
import { handleStorefrontCreateQuote } from "~/features/storefront/storefront-create-quote.server";
import { handleStorefrontMessage } from "~/features/storefront/storefront-messages.server";
import { storefrontJson as json } from "~/features/storefront/storefront-response.server";
import { handleStorefrontStatus } from "~/features/storefront/storefront-status.server";
import { authenticate } from "~/shopify.server";

export { storefrontLoader } from "~/features/storefront/storefront-loader.server";

export const storefrontAction = async (args: ActionFunctionArgs) => {
  try {
    return await handleStorefrontAction(args);
  } catch (error) {
    console.error("[SP RFQ] Storefront proxy action failed", error);
    if (error instanceof Response) return error;
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Storefront quote request failed",
      },
      { status: 500 },
    );
  }
};

async function handleStorefrontAction({ request, params }: ActionFunctionArgs) {
  const context = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = context.session?.shop ?? url.searchParams.get("shop");
  if (!shop) return json({ error: "Shop session not found" }, { status: 401 });

  const body = await request.json();
  const path = params["*"] ?? "";
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");

  if (path.endsWith("/messages")) {
    return handleStorefrontMessage({
      admin: context.admin,
      body,
      customerId: loggedInCustomerId,
      path,
      request,
      shop,
    });
  }

  if (path.endsWith("/status")) {
    return handleStorefrontStatus({
      admin: context.admin,
      body,
      customerId: loggedInCustomerId,
      path,
      shop,
    });
  }

  return handleStorefrontCreateQuote({
    admin: context.admin,
    body,
    customerId: loggedInCustomerId ?? String(body.customerId ?? ""),
    shop,
  });
}

