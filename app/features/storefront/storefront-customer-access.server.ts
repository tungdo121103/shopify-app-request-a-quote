import { storefrontJson } from "~/features/storefront/storefront-response.server";
import type { AdminGraphqlClient, StorefrontQuote } from "~/features/storefront/storefront.types";

export function normalizeShopifyId(id: string) {
  return String(id || "").split("/").pop() ?? "";
}

export async function authorizeQuoteCustomer(input: {
  admin?: AdminGraphqlClient;
  customerId: string | null;
  quote: Pick<StorefrontQuote, "customerId" | "customerEmail">;
}) {
  const loggedInCustomerId = normalizeShopifyId(input.customerId ?? "");
  if (!loggedInCustomerId) {
    return storefrontJson({ error: "Please log in to view this quote." }, { status: 401 });
  }
  if (!input.admin) {
    return storefrontJson(
      { error: "Customer verification is temporarily unavailable." },
      { status: 503 },
    );
  }

  const response = await input.admin.graphql(
    `#graphql
      query QuoteCustomerIdentity($id: ID!) {
        customer(id: $id) {
          id
          email
        }
      }`,
    { variables: { id: `gid://shopify/Customer/${loggedInCustomerId}` } },
  );
  const result = await response.json();
  const customer = result.data?.customer as
    | { id?: string; email?: string | null }
    | null
    | undefined;
  if (!customer?.id) {
    return storefrontJson({ error: "Customer account not found." }, { status: 403 });
  }

  const quoteCustomerId = normalizeShopifyId(input.quote.customerId ?? "");
  const idMatches = !quoteCustomerId || quoteCustomerId === loggedInCustomerId;
  const quoteEmail = input.quote.customerEmail?.trim().toLowerCase() ?? "";
  const loggedInEmail = customer.email?.trim().toLowerCase() ?? "";
  const emailMatches = !quoteEmail || quoteEmail === loggedInEmail;
  if (!idMatches || !emailMatches) {
    return storefrontJson(
      { error: "This quote belongs to a different customer account." },
      { status: 403 },
    );
  }
  return null;
}
