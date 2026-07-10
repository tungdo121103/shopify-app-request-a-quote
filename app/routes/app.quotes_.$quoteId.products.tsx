import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";

type AdminProductSearchItem = {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  imageUrl: string;
};

async function searchAdminProducts(admin: unknown, query: string) {
  try {
    const response = await (
      admin as {
        graphql: (
          query: string,
          options: { variables: Record<string, string | number | null> },
        ) => Promise<Response>;
      }
    ).graphql(
      `#graphql
        query QuoteProductPicker($query: String, $first: Int!) {
          products(first: $first, query: $query) {
            nodes {
              id
              title
              featuredMedia {
                preview {
                  image {
                    url
                  }
                }
              }
              variants(first: 10) {
                nodes {
                  id
                  title
                  sku
                  price
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { query: query || null, first: 10 } },
    );
    const payload = (await response.json()) as {
      data?: {
        products?: {
          nodes?: Array<{
            id?: string | null;
            title?: string | null;
            featuredMedia?: {
              preview?: { image?: { url?: string | null } | null } | null;
            } | null;
            variants?: {
              nodes?: Array<{
                id: string;
                title?: string | null;
                sku?: string | null;
                price?: string | number | null;
                image?: { url?: string | null } | null;
              }>;
            } | null;
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      console.warn("[RFQ] Product search GraphQL errors", payload.errors);
    }

    return (payload.data?.products?.nodes ?? [])
      .map((product) => {
        const variant = product.variants?.nodes?.[0];
        if (!variant) return null;

        return {
        productId: product.id ?? "",
        variantId: variant.id,
        title: product.title ?? "Product",
        variantTitle: variant.title ?? "Default Title",
        sku: variant.sku ?? "",
        price: Number(variant.price ?? 0),
        imageUrl:
          variant.image?.url ??
          product.featuredMedia?.preview?.image?.url ??
          "",
        };
      })
      .filter((product): product is AdminProductSearchItem => Boolean(product));
  } catch (error) {
    console.warn("[RFQ] Could not search admin products.", error);
    return [];
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";
    const products = await searchAdminProducts(
      admin,
      query ? `title:*${query}* OR sku:*${query}*` : "",
    );

    return Response.json({ products });
  } catch (error) {
    console.warn("[RFQ] Product picker resource failed.", error);
    return Response.json({ products: [] });
  }
};
