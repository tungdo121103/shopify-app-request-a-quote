import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getQuoteSettings,
  normalizeSettingsForm,
  updateQuoteSettings,
  validateExpirationSettingsForm,
} from "~/models/quote-setting.server";
import { authenticate } from "~/shopify.server";

export async function loadQuoteSettings({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const search = url.searchParams.get("q")?.trim() ?? "";

  if (resource === "customers") {
    try {
      const response = await admin.graphql(
        `#graphql
          query SearchQuoteSettingCustomers($query: String!) {
            customers(first: 10, query: $query) {
              nodes { id displayName defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber } }
            }
          }`,
        { variables: { query: search } },
      );
      const result = await response.json();
      const customers = (result.data?.customers?.nodes ?? []).map(
        (customer: { id?: string; displayName?: string; defaultEmailAddress?: { emailAddress?: string | null } | null; defaultPhoneNumber?: { phoneNumber?: string | null } | null }) => ({
          id: String(customer.id ?? ""),
          name: String(customer.displayName ?? "Customer"),
          email: String(customer.defaultEmailAddress?.emailAddress ?? ""),
          phone: String(customer.defaultPhoneNumber?.phoneNumber ?? ""),
        }),
      );
      return { customers };
    } catch (error) {
      console.warn("Unable to search customers for quote settings", error);
      return { customers: [], customerSearchError: "Customer search requires Shopify protected customer data access." };
    }
  }

  if (resource === "eligibility-products") {
    const response = await admin.graphql(
      `#graphql
        query SearchQuoteSettingProducts($query: String!) {
          products(first: 10, query: $query, sortKey: TITLE) { nodes { id title featuredImage { url } } }
        }`,
      { variables: { query: search ? `${search} status:active` : "status:active" } },
    );
    const result = await response.json();
    return {
      resources: (result.data?.products?.nodes ?? []).map(
        (product: { id?: string; title?: string; featuredImage?: { url?: string } }) => ({
          id: String(product.id ?? ""), type: "PRODUCT" as const,
          title: String(product.title ?? "Product"), imageUrl: String(product.featuredImage?.url ?? ""),
        }),
      ),
    };
  }

  if (resource === "eligibility-collections") {
    const response = await admin.graphql(
      `#graphql
        query SearchQuoteSettingCollections($query: String!) {
          collections(first: 10, query: $query, sortKey: TITLE) { nodes { id title image { url } } }
        }`,
      { variables: { query: search } },
    );
    const result = await response.json();
    return {
      resources: (result.data?.collections?.nodes ?? []).map(
        (collection: { id?: string; title?: string; image?: { url?: string } }) => ({
          id: String(collection.id ?? ""), type: "COLLECTION" as const,
          title: String(collection.title ?? "Collection"), imageUrl: String(collection.image?.url ?? ""),
        }),
      ),
    };
  }

  return { settings: await getQuoteSettings(session.shop) };
}

export async function saveQuoteSettings({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const fieldErrors = validateExpirationSettingsForm(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return Response.json({ ok: false, message: "Check the quote expiration settings and try again.", fieldErrors }, { status: 400 });
  }
  await updateQuoteSettings(session.shop, normalizeSettingsForm(formData));
  return {
    ok: true,
    message: "Quote settings saved.",
    fieldErrors: { quoteExpiresAfterDays: undefined, reminderBeforeExpireDays: undefined },
  };
}

export type QuoteSettings = Awaited<ReturnType<typeof getQuoteSettings>>;
