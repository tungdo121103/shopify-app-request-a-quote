import { requestActorHash, requestIpHash } from "~/lib/request-identity.server";
import { addMessage, getQuote } from "~/models/quote.server";
import { storefrontJson } from "~/features/storefront/storefront-response.server";
import { normalizeStorefrontAttachments } from "~/features/storefront/storefront-attachments";
import { authorizeQuoteCustomer } from "~/features/storefront/storefront-customer-access.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";

type MessageInput = {
  admin?: AdminGraphqlClient;
  body: Record<string, unknown>;
  customerId: string | null;
  path: string;
  request: Request;
  shop: string;
};

export async function handleStorefrontMessage(input: MessageInput) {
  const quoteId = input.path.split("/")[1];
  const quote = await getQuote(input.shop, quoteId);
  if (!quote) return storefrontJson({ error: "Quote not found" }, { status: 404 });

  const accessError = await authorizeQuoteCustomer({
    admin: input.admin,
    customerId: input.customerId,
    quote,
  });
  if (accessError) return accessError;

  try {
    const message = await addMessage({
      quoteId,
      shop: input.shop,
      sender: "CUSTOMER",
      senderName: String(input.body.customerName ?? "Customer"),
      message: String(input.body.message ?? ""),
      clientMessageId: String(input.body.clientMessageId ?? ""),
      sourceIpHash: requestIpHash(input.request),
      sourceActorHash: requestActorHash(
        `${input.shop}:customer:${input.customerId || quote.customerEmail || ""}`,
      ),
      attachments: normalizeStorefrontAttachments(
        input.body.attachments ?? input.body.attachment,
      ),
    });
    return storefrontJson({ ok: true, message });
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    const retryAfter = error.headers.get("Retry-After");
    return storefrontJson(
      { error: await error.text() },
      {
        status: error.status,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
      },
    );
  }
}
