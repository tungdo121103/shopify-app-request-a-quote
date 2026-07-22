import type { LoaderFunctionArgs } from "react-router";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";
import { getQuote, markQuoteRead } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

type LiveCustomer = {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountry: string | null;
  customerRegion: string | null;
  customerAddress: string | null;
};

async function getLiveCustomerInfo(
  admin: AdminGraphqlClient,
  customerId?: string | null,
): Promise<LiveCustomer | null> {
  const numericId = customerId?.split("/").pop();
  if (!numericId) return null;

  try {
    const response = await admin.graphql(
      `#graphql
        query QuoteCustomer($id: ID!) {
          customer(id: $id) {
            displayName
            firstName
            lastName
            defaultEmailAddress { emailAddress }
            defaultPhoneNumber { phoneNumber }
            defaultAddress {
              firstName
              lastName
              address1
              city
              province
              country
            }
          }
        }
      `,
      { variables: { id: `gid://shopify/Customer/${numericId}` } },
    );
    const payload = (await response.json()) as {
      data?: {
        customer?: {
          displayName?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          defaultEmailAddress?: { emailAddress?: string | null } | null;
          defaultPhoneNumber?: { phoneNumber?: string | null } | null;
          defaultAddress?: {
            firstName?: string | null;
            lastName?: string | null;
            address1?: string | null;
            city?: string | null;
            province?: string | null;
            country?: string | null;
          } | null;
        } | null;
      };
    };
    const customer = payload.data?.customer;
    if (!customer) return null;

    const customerEmail =
      customer.defaultEmailAddress?.emailAddress?.trim() || null;
    const customerName =
      joinName(customer.firstName, customer.lastName) ||
      joinName(
        customer.defaultAddress?.firstName,
        customer.defaultAddress?.lastName,
      ) ||
      (hasMeaningfulCustomerName(customer.displayName, customerEmail)
        ? customer.displayName?.trim() || null
        : null);
    const customerAddress = [
      customer.defaultAddress?.address1,
      customer.defaultAddress?.city,
      customer.defaultAddress?.country,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      customerName,
      customerEmail,
      customerPhone: customer.defaultPhoneNumber?.phoneNumber || null,
      customerCountry: customer.defaultAddress?.country || null,
      customerRegion: customer.defaultAddress?.province || null,
      customerAddress: customerAddress || null,
    };
  } catch (error) {
    console.warn("[RFQ] Could not load live customer info.", error);
    return null;
  }
}

async function getLiveDraftOrderInfo(
  admin: AdminGraphqlClient,
  draftOrderId?: string | null,
) {
  if (!draftOrderId) return null;

  try {
    const response = await admin.graphql(
      `#graphql
        query QuoteDraftOrder($id: ID!) {
          draftOrder(id: $id) {
            order { id name }
          }
        }
      `,
      { variables: { id: draftOrderId } },
    );
    const payload = (await response.json()) as {
      data?: {
        draftOrder?: {
          order?: { id?: string | null; name?: string | null } | null;
        } | null;
      };
    };
    const draftOrder = payload.data?.draftOrder;
    if (!draftOrder) return null;

    return {
      orderId: draftOrder.order?.id || null,
      orderName: draftOrder.order?.name || null,
    };
  } catch (error) {
    console.warn("[RFQ] Could not load live Draft Order info.", error);
    return null;
  }
}

function joinName(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" ");
}

function hasMeaningfulCustomerName(
  customerName?: string | null,
  customerEmail?: string | null,
) {
  const normalizedName = customerName?.trim().toLowerCase() ?? "";
  const normalizedEmail = customerEmail?.trim().toLowerCase() ?? "";
  return Boolean(
    normalizedName &&
      normalizedName !== "demo buyer" &&
      normalizedName !== normalizedEmail &&
      !normalizedName.includes("@"),
  );
}

export async function handleQuoteDetailLoader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const quote = await getQuote(session.shop, params.quoteId ?? "");
  if (!quote) throw new Response("Quote not found", { status: 404 });

  const [liveCustomer, liveDraftOrder] = await Promise.all([
    getLiveCustomerInfo(admin, quote.customerId),
    getLiveDraftOrderInfo(admin, quote.orderId),
    markQuoteRead({
      shop: session.shop,
      quoteId: quote.id,
      viewer: "MANAGER",
      viewerId: "manager",
    }),
  ]);
  const hydratedQuote = liveCustomer
    ? {
        ...quote,
        customerName: hasMeaningfulCustomerName(
          quote.customerName,
          quote.customerEmail,
        )
          ? quote.customerName
          : liveCustomer.customerName || quote.customerName,
        customerEmail: quote.customerEmail || liveCustomer.customerEmail,
        customerPhone: quote.customerPhone || liveCustomer.customerPhone,
        customerCountry: quote.customerCountry || liveCustomer.customerCountry,
        customerRegion: quote.customerRegion || liveCustomer.customerRegion,
        customerAddress: quote.customerAddress || liveCustomer.customerAddress,
      }
    : quote;

  const shopHandle = session.shop.replace(".myshopify.com", "");
  const draftOrderNumericId = hydratedQuote.orderId?.split("/").pop();
  const orderNumericId = liveDraftOrder?.orderId?.split("/").pop();

  return {
    quote: hydratedQuote,
    draftOrderAdminUrl:
      draftOrderNumericId && hydratedQuote.orderId
        ? `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`
        : null,
    shopifyOrderName: liveDraftOrder?.orderName ?? null,
    shopifyOrderAdminUrl:
      orderNumericId && liveDraftOrder?.orderId
        ? `https://admin.shopify.com/store/${shopHandle}/orders/${orderNumericId}`
        : null,
  };
}
