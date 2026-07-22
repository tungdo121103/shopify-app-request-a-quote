import type { LoaderFunctionArgs } from "react-router";
import { isValidE164Phone, isValidEmail } from "~/lib/contact-validation";
import { normalizeShopifyId } from "~/features/storefront/storefront-customer-access.server";
import { contactMatchType, findCustomerByContact } from "~/features/storefront/storefront-customer.server";
import { isProductEligibleForQuote, loadProductsForEligibility } from "~/features/storefront/storefront-product-eligibility.server";
import { handleStorefrontQuoteRead } from "~/features/storefront/storefront-quote-read.server";
import { storefrontJson as json } from "~/features/storefront/storefront-response.server";
import { toStorefrontWidgetSettings } from "~/features/widget/widget-settings";
import { getQuoteSettings } from "~/models/quote-setting.server";
import { authenticate } from "~/shopify.server";

export const storefrontLoader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = context.session?.shop ?? url.searchParams.get("shop");
  if (!shop) return json({ error: "Shop session not found" }, { status: 401 });

  const path = params["*"] ?? "";
  const customerId =
    url.searchParams.get("logged_in_customer_id") ??
    url.searchParams.get("customerId");
  const customerEmail = url.searchParams.get("customerEmail") ?? "";

  if (path === "settings") {
    const settings = await getQuoteSettings(shop);
    return json({
      settings: toStorefrontWidgetSettings(settings),
    });
  }

  if (path === "validate-contact") {
    if (!context.admin) {
      return json({ error: "Shop Admin API is unavailable" }, { status: 401 });
    }

    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    const phone = url.searchParams.get("phone")?.trim() ?? "";
    const errors: Record<string, string> = {};

    if (email && !isValidEmail(email)) {
      errors.email = "Email is invalid";
    }

    if (phone && !isValidE164Phone(phone)) {
      errors.phone = "Please enter a valid phone number";
    }

    if (Object.keys(errors).length > 0) {
      return json({ ok: false, errors }, { status: 400 });
    }

    const customer = await findCustomerByContact(context.admin, email, phone);
    return json({
      ok: true,
      customerExists: Boolean(customer),
      customer,
      matchedBy: contactMatchType(customer, email, phone),
    });
  }

  if (path === "eligibility") {
    if (!context.admin) {
      return json({ error: "Shop Admin API is unavailable" }, { status: 401 });
    }

    const productIds = (url.searchParams.get("productIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const settings = await getQuoteSettings(shop);

    if (!productIds.length) {
      return json({ eligibleByProductId: {}, defaultEligible: true });
    }

    if (settings.productEligibility === "ALL") {
      return json({
        eligibleByProductId: Object.fromEntries(
          productIds.map((productId) => [normalizeShopifyId(productId), true]),
        ),
        defaultEligible: true,
      });
    }

    const products = await loadProductsForEligibility(context.admin, productIds);
    const eligibleByProductId = Object.fromEntries(
      productIds.map((productId) => {
        const normalizedProductId = normalizeShopifyId(productId);
        const product = products.get(normalizedProductId);
        return [
          normalizedProductId,
          isProductEligibleForQuote(
            productId,
            product?.collectionIds ?? [],
            settings,
          ),
        ];
      }),
    );

    return json({ eligibleByProductId, defaultEligible: false });
  }

  if (path === "products") {
    if (!context.admin) {
      return json({ error: "Shop Admin API is unavailable" }, { status: 401 });
    }

    const search = url.searchParams.get("q")?.trim() ?? "";
    const settings = await getQuoteSettings(shop);
    const response = await context.admin.graphql(
      `#graphql
        query SearchQuoteProducts($query: String!, $first: Int!) {
          products(first: $first, query: $query, sortKey: TITLE) {
            nodes {
              id
              title
              featuredImage {
                url
                altText
              }
              variants(first: 1) {
                nodes {
                  id
                  title
                  price
                  compareAtPrice
                  inventoryQuantity
                }
              }
              collections(first: 20) {
                nodes {
                  id
                }
              }
            }
          }
        }`,
      {
        variables: {
          query: search
            ? `${search} status:active published_status:published`
            : "status:active published_status:published",
          first: 20,
        },
      },
    );
    const result = await response.json();
    const products = (result.data?.products?.nodes ?? [])
      .map(
        (product: {
          id: string;
          title: string;
          featuredImage?: { url: string; altText?: string };
          variants: {
            nodes: Array<{
              id: string;
              title: string;
              price: string;
              compareAtPrice?: string | null;
              inventoryQuantity?: number;
            }>;
          };
          collections?: {
            nodes: Array<{ id: string }>;
          };
        }) => {
          const variant = product.variants.nodes[0];
          if (!variant) return null;

          const collectionIds =
            product.collections?.nodes.map((collection) => collection.id) ?? [];
          if (!isProductEligibleForQuote(product.id, collectionIds, settings)) {
            return null;
          }

          return {
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variantTitle: variant.title,
            imageUrl: product.featuredImage?.url ?? "",
            imageAlt: product.featuredImage?.altText ?? product.title,
            unitPrice: Number(variant.price),
            compareAtPrice: Number(variant.compareAtPrice ?? 0),
            inventoryQuantity: variant.inventoryQuantity ?? null,
            inventoryStatus:
              variant.inventoryQuantity !== null &&
              variant.inventoryQuantity !== undefined &&
              variant.inventoryQuantity <= 0
                ? "OUT_OF_STOCK"
                : "AVAILABLE",
          };
        },
      )
      .filter(Boolean);

    return json({ products });
  }

  return handleStorefrontQuoteRead({
    admin: context.admin,
    customerEmail,
    customerId,
    path,
    shop,
    url,
  });
};
