import { addMessage, getQuote, updateQuoteStatus } from "~/models/quote.server";
import { queueQuoteNotification, verifyQuotePortalToken } from "~/features/email/quote-email.server";
import { quoteToEmailContext } from "~/features/email/rendering/quote-email-context";
import { authorizeQuoteCustomer } from "~/features/storefront/storefront-customer-access.server";
import { storefrontJson } from "~/features/storefront/storefront-response.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";

type StatusInput = {
  admin?: AdminGraphqlClient;
  body: Record<string, unknown>;
  customerId: string | null;
  path: string;
  shop: string;
};

export async function handleStorefrontStatus(input: StatusInput) {
  const quoteId = input.path.split("/")[1];
  const status = String(input.body.status ?? "");
  const quote = await getQuote(input.shop, quoteId);
  if (!quote) return storefrontJson({ error: "Quote not found" }, { status: 404 });

  const portalToken = String(input.body.portalToken ?? "");
  if (portalToken && !verifyQuotePortalToken(portalToken, input.shop, quoteId)) {
    return storefrontJson({ error: "Invalid quote link" }, { status: 403 });
  }
  const accessError = await authorizeQuoteCustomer({
    admin: input.admin,
    customerId: input.customerId,
    quote,
  });
  if (accessError) return accessError;
  if (status !== "ACCEPTED" && status !== "DECLINED") {
    return storefrontJson({ error: "Invalid quote status." }, { status: 400 });
  }
  if (quote.status === status) return storefrontJson({ ok: true, unchanged: true });
  if (String(quote.status) === "EXPIRED") {
    return storefrontJson(
      { error: "This quote has expired and can no longer be accepted." },
      { status: 409 },
    );
  }
  if (quote.status !== "OFFERED_BY_MERCHANT") {
    return storefrontJson(
      { error: "Only a sent merchant offer can be accepted or declined." },
      { status: 409 },
    );
  }

  try {
    await updateQuoteStatus(input.shop, quoteId, status);
  } catch (error) {
    if (error instanceof Response) {
      return storefrontJson(
        { error: await error.text() },
        { status: error.status || 409 },
      );
    }
    throw error;
  }

  await addMessage({
    quoteId,
    shop: input.shop,
    sender: "CUSTOMER",
    senderName: String(input.body.customerName ?? "Customer"),
    message: status === "ACCEPTED" ? "Quote accepted." : "Quote declined.",
    messageType: "SYSTEM",
    eventType: status === "ACCEPTED" ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED",
  });

  const updatedQuote = await getQuote(input.shop, quoteId);
  if (updatedQuote) {
    await queueQuoteNotification({
      shop: input.shop,
      quote: quoteToEmailContext(updatedQuote),
      templateKey: status === "ACCEPTED" ? "quote_accepted" : "quote_declined",
      idempotencyKey: `${input.shop}:${quoteId}:${status === "ACCEPTED" ? "quote_accepted" : "quote_declined"}:v${updatedQuote.offerVersion}`,
    });
  }
  return storefrontJson({ ok: true });
}
