import { normalizeShopifyId } from "~/features/storefront/storefront-customer-access.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";
import { parseSelectedProductResources } from "~/features/settings/quote-eligibility";
import { getQuoteSettings } from "~/models/quote-setting.server";

type ProductEligibilitySettings = {
  productEligibility: string;
  selectedProductResources?: string | null;
  allowedProductResources?: string | null;
  excludedProductResources?: string | null;
};

export async function validateQuoteItemsProductEligibility(input: {
  admin?: AdminGraphqlClient | null;
  shop: string;
  items: unknown[];
}) {
  const settings = await getQuoteSettings(input.shop);
  if (settings.productEligibility === "ALL") return { allowed: true };

  const selectedResources = parseSelectedProductResources(
    getProductResourcesForEligibility(settings),
  );
  if (!selectedResources.length) {
    return {
      allowed: settings.productEligibility === "EXCLUDED",
      reason:
        settings.productEligibility === "SELECTED"
          ? "No products are currently eligible for quote requests."
          : undefined,
    };
  }

  const productIds = input.items
    .map((item) =>
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).productId ?? "")
        : "",
    )
    .filter(Boolean);
  if (!productIds.length) {
    return { allowed: false, reason: "Quote items are missing product data." };
  }

  if (!input.admin) {
    const allowed = productIds.every((productId) =>
      isProductEligibleForQuote(productId, [], settings),
    );
    return {
      allowed,
      reason: allowed
        ? undefined
        : "One or more products are not eligible for quote requests.",
    };
  }

  const products = await loadProductsForEligibility(input.admin, productIds);
  const allowed = productIds.every((productId) => {
    const product = products.get(normalizeShopifyId(productId));
    return isProductEligibleForQuote(
      productId,
      product?.collectionIds ?? [],
      settings,
    );
  });
  return {
    allowed,
    reason: allowed
      ? undefined
      : "One or more products are not eligible for quote requests.",
  };
}

export async function loadProductsForEligibility(
  admin: AdminGraphqlClient,
  productIds: string[],
) {
  const ids = Array.from(
    new Set(
      productIds
        .map(normalizeShopifyId)
        .filter(Boolean)
        .map((id) => `gid://shopify/Product/${id}`),
    ),
  );
  const products = new Map<string, { id: string; collectionIds: string[] }>();
  if (!ids.length) return products;

  const response = await admin.graphql(
    `#graphql
      query QuoteProductEligibilityNodes($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            collections(first: 30) { nodes { id } }
          }
        }
      }`,
    { variables: { ids } },
  );
  const result = await response.json();
  for (const node of result.data?.nodes ?? []) {
    if (!node?.id) continue;
    products.set(normalizeShopifyId(String(node.id)), {
      id: String(node.id),
      collectionIds:
        node.collections?.nodes?.map((collection: { id: string }) =>
          String(collection.id),
        ) ?? [],
    });
  }
  return products;
}

export function isProductEligibleForQuote(
  productId: string,
  collectionIds: string[],
  settings: ProductEligibilitySettings,
) {
  if (settings.productEligibility === "ALL") return true;
  const resources = parseSelectedProductResources(
    getProductResourcesForEligibility(settings),
  );
  if (!resources.length) return settings.productEligibility === "EXCLUDED";

  const normalizedProductId = normalizeShopifyId(productId);
  const normalizedCollectionIds = new Set(collectionIds.map(normalizeShopifyId));
  const matchesResource = resources.some((resource) => {
    const resourceId = normalizeShopifyId(resource.id);
    return resource.type === "PRODUCT"
      ? resourceId === normalizedProductId
      : normalizedCollectionIds.has(resourceId);
  });
  if (settings.productEligibility === "SELECTED") return matchesResource;
  if (settings.productEligibility === "EXCLUDED") return !matchesResource;
  return true;
}

function getProductResourcesForEligibility(settings: ProductEligibilitySettings) {
  if (settings.productEligibility === "EXCLUDED") {
    return settings.excludedProductResources ?? "";
  }
  if (settings.productEligibility === "SELECTED") {
    return settings.allowedProductResources ?? settings.selectedProductResources ?? "";
  }
  return "";
}
