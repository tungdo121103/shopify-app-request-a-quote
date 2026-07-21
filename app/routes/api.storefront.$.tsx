import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  addMessage,
  createStorefrontQuote,
  getQuote,
  listCustomerQuotes,
  markQuoteRead,
  updateQuoteStatus,
} from "~/models/quote.server";
import { getQuoteSettings } from "~/models/quote-setting.server";
import { getQuotePdfSetting } from "~/models/quote-pdf-setting.server";
import {
  getEmailBranding,
  queueQuoteNotification,
  verifyQuotePortalToken,
} from "~/models/quote-email.server";
import { createQuotePdf } from "~/lib/quote-pdf.server";
import { authenticate } from "~/shopify.server";
import {
  requestActorHash,
  requestIpHash,
} from "~/lib/request-identity.server";

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });

type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
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
      settings: storefrontWidgetSettings(settings),
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

  if (/^quotes\/[^/]+\/pdf$/.test(path)) {
    const quoteId = path.split("/")[1];
    const quote = await getQuote(shop, quoteId);
    if (!quote) return json({ error: "Quote not found" }, { status: 404 });
    const portalToken = url.searchParams.get("portalToken") ?? "";
    if (portalToken && !verifyQuotePortalToken(portalToken, shop, quoteId)) {
      return json({ error: "Invalid quote link" }, { status: 403 });
    }
    const accessError = await authorizeQuoteCustomer({
      admin: context.admin,
      customerId,
      quote,
    });
    if (accessError) return accessError;

    const [settings, branding] = await Promise.all([
      getQuotePdfSetting(shop),
      getEmailBranding(shop),
    ]);
    const pdf = await createQuotePdf(quote, settings, {
      logoUrl: branding.logoUrl,
      storeName: branding.senderName || shop.replace(/\.myshopify\.com$/i, ""),
    });
    const fileName = `${quote.quoteNumber.replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (path.startsWith("quotes/")) {
    const quoteId = path.split("/")[1];
    const quote = await getQuote(shop, quoteId);
    if (!quote) return json({ error: "Quote not found" }, { status: 404 });
    const portalToken = url.searchParams.get("portalToken") ?? "";
    if (portalToken && !verifyQuotePortalToken(portalToken, shop, quoteId)) {
      return json({ error: "Invalid quote link" }, { status: 403 });
    }
    const accessError = await authorizeQuoteCustomer({
      admin: context.admin,
      customerId,
      quote,
    });
    if (accessError) return accessError;
    if (customerId) {
      await markQuoteRead({
        shop,
        quoteId: quote.id,
        viewer: "CUSTOMER",
        viewerId: customerId,
      });
    }
    return json({ quote });
  }

  if (!customerId && !customerEmail) return json({ quotes: [] });
  const quotes = await listCustomerQuotes(shop, customerId ?? "", customerEmail);
  return json({ quotes });
};

function quoteToEmailContext(
  quote: Exclude<Awaited<ReturnType<typeof getQuote>>, null>,
) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName || "Customer",
    customerEmail: quote.customerEmail ?? null,
    quoteTotal: quote.quoteTotal,
    originalTotal: quote.originalTotal,
    currency: quote.currency,
    status: String(quote.status),
    note: quote.note ?? null,
    expiresAt: quote.expiresAt ? String(quote.expiresAt) : null,
    items: quote.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      quotePrice: item.quotePrice,
      unitPrice: item.unitPrice,
      imageUrl: item.imageUrl ?? undefined,
      sku: item.sku ?? undefined,
      variantTitle: item.variantTitle ?? undefined,
    })),
  };
}

export const action = async (args: ActionFunctionArgs) => {
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

  if (path.endsWith("/messages")) {
    const quoteId = path.split("/")[1];
    const quote = await getQuote(shop, quoteId);
    if (!quote) return json({ error: "Quote not found" }, { status: 404 });
    const customerId = url.searchParams.get("logged_in_customer_id");
    const accessError = await authorizeQuoteCustomer({
      admin: context.admin,
      customerId,
      quote,
    });
    if (accessError) return accessError;

    try {
      const message = await addMessage({
        quoteId,
        shop,
        sender: "CUSTOMER",
        senderName: String(body.customerName ?? "Customer"),
        message: String(body.message ?? ""),
        clientMessageId: String(body.clientMessageId ?? ""),
        sourceIpHash: requestIpHash(request),
        sourceActorHash: requestActorHash(
          `${shop}:customer:${customerId || quote.customerEmail || ""}`,
        ),
        attachments: normalizeAttachments(body.attachments ?? body.attachment),
      });
      return json({ ok: true, message });
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      const retryAfter = error.headers.get("Retry-After");
      return json(
        { error: await error.text() },
        {
          status: error.status,
          headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
        },
      );
    }
  }

  if (path.endsWith("/status")) {
    const quoteId = path.split("/")[1];
    const status = String(body.status ?? "");
    const quote = await getQuote(shop, quoteId);
    const customerId = url.searchParams.get("logged_in_customer_id");

    if (!quote) return json({ error: "Quote not found" }, { status: 404 });
    const portalToken = String(body.portalToken ?? "");
    if (portalToken && !verifyQuotePortalToken(portalToken, shop, quoteId)) {
      return json({ error: "Invalid quote link" }, { status: 403 });
    }
    const accessError = await authorizeQuoteCustomer({
      admin: context.admin,
      customerId,
      quote,
    });
    if (accessError) return accessError;
    if (status !== "ACCEPTED" && status !== "DECLINED") {
      return json({ error: "Invalid quote status." }, { status: 400 });
    }
    if (quote.status === status) {
      return json({ ok: true, unchanged: true });
    }
    if (String(quote.status) === "EXPIRED") {
      return json(
        { error: "This quote has expired and can no longer be accepted." },
        { status: 409 },
      );
    }
    if (quote.status !== "OFFERED_BY_MERCHANT") {
      return json(
        { error: "Only a sent merchant offer can be accepted or declined." },
        { status: 409 },
      );
    }

    try {
      await updateQuoteStatus(shop, quoteId, status);
    } catch (error) {
      if (error instanceof Response) {
        return json(
          { error: await error.text() },
          { status: error.status || 409 },
        );
      }
      throw error;
    }
    await addMessage({
      quoteId,
      shop,
      sender: "CUSTOMER",
      senderName: String(body.customerName ?? "Customer"),
      message:
        status === "ACCEPTED"
          ? "Quote accepted."
          : "Quote declined.",
      messageType: "SYSTEM",
      eventType: status === "ACCEPTED" ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED",
    });

    const updatedQuote = await getQuote(shop, quoteId);
    if (updatedQuote) {
      await queueQuoteNotification({
        shop,
        quote: quoteToEmailContext(updatedQuote),
        templateKey: status === "ACCEPTED" ? "quote_accepted" : "quote_declined",
        idempotencyKey: `${shop}:${quoteId}:${status === "ACCEPTED" ? "quote_accepted" : "quote_declined"}:v${updatedQuote.offerVersion}`,
      });
    }

    return json({ ok: true });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: "At least one quote item is required" }, { status: 400 });
  }

  const customerId =
    url.searchParams.get("logged_in_customer_id") ??
    String(body.customerId ?? "");
  const customerEmail = String(body.customerEmail ?? "").trim().toLowerCase();
  const customerPhone = String(body.customerPhone ?? "").trim();

  if (!customerId && !isValidEmail(customerEmail)) {
    return json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (customerPhone && !isValidE164Phone(customerPhone)) {
    return json(
      { error: "Please enter a valid phone number." },
      { status: 400 },
    );
  }

  const eligibility = await validateRequesterEligibility({
    admin: context.admin,
    shop,
    customerId,
    customerEmail,
    customerPhone,
  });

  if (!eligibility.allowed) {
    return json(
      {
        code: "NOT_ELIGIBLE_TO_REQUEST_QUOTE",
        message: "Your account is not eligible to request quotes.",
        error: eligibility.reason,
      },
      { status: 403 },
    );
  }

  const productEligibility = await validateQuoteItemsProductEligibility({
    admin: context.admin,
    shop,
    items: body.items,
  });

  if (!productEligibility.allowed) {
    return json(
      {
        code: "PRODUCT_NOT_ELIGIBLE_FOR_QUOTE",
        message: productEligibility.reason,
        error: productEligibility.reason,
      },
      { status: 400 },
    );
  }

  const quote = await createStorefrontQuote({
    shop,
    customerId,
    customerName: String(body.customerName ?? ""),
    customerEmail,
    customerPhone,
    customerCountry: String(body.customerCountry ?? ""),
    customerRegion: String(body.customerRegion ?? ""),
    customerAddress: String(body.customerAddress ?? ""),
    currency: String(body.currency ?? "USD"),
    note: String(body.note ?? ""),
    items: body.items.map((item: Record<string, unknown>) => ({
      productId: String(item.productId ?? ""),
      variantId: String(item.variantId ?? ""),
      variantTitle: String(item.variantTitle ?? ""),
      title: String(item.title ?? "Product"),
      imageUrl: String(item.imageUrl ?? ""),
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      unitPrice: Math.max(0, Number(item.unitPrice ?? 0)),
      quotePrice: Math.max(0, Number(item.quotePrice ?? item.unitPrice ?? 0)),
      inventoryStatus: String(item.inventoryStatus ?? "AVAILABLE"),
    })),
    attachments: normalizeAttachments(body.attachments ?? body.attachment),
  });

  return json({ quote }, { status: 201 });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidE164Phone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function contactMatchType(
  customer: Awaited<ReturnType<typeof findCustomerByContact>>,
  email: string,
  phone: string,
) {
  if (!customer) return null;
  if (phone && customer.phone && phoneDigits(customer.phone) === phoneDigits(phone)) {
    return "phone";
  }
  if (
    email &&
    customer.email &&
    customer.email.toLowerCase() === email.toLowerCase()
  ) {
    return "email";
  }
  return null;
}

type RequesterEligibilityInput = {
  admin?: AdminGraphqlClient | null;
  shop: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
};

type SelectedCustomer = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
};

type SelectedProductResource = {
  id: string;
  type: "PRODUCT" | "COLLECTION";
  title?: string;
};

type CustomerSegmentProfile = {
  id: string;
  email: string;
  phone: string;
  ordersCount: number;
  acceptsEmailMarketing: boolean;
};

async function validateQuoteItemsProductEligibility(input: {
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
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      return String((item as Record<string, unknown>).productId ?? "");
    })
    .filter(Boolean);

  if (!productIds.length) {
    return { allowed: false, reason: "Quote items are missing product data." };
  }

  if (!input.admin) {
    const productOnlyCheck = productIds.every((productId) =>
      isProductEligibleForQuote(productId, [], settings),
    );
    return {
      allowed: productOnlyCheck,
      reason: productOnlyCheck
        ? undefined
        : "One or more products are not eligible for quote requests.",
    };
  }

  const products = await loadProductsForEligibility(input.admin, productIds);
  const allAllowed = productIds.every((productId) => {
    const product = products.get(normalizeShopifyId(productId));
    return isProductEligibleForQuote(
      productId,
      product?.collectionIds ?? [],
      settings,
    );
  });

  return {
    allowed: allAllowed,
    reason: allAllowed
      ? undefined
      : "One or more products are not eligible for quote requests.",
  };
}

async function loadProductsForEligibility(
  admin: AdminGraphqlClient,
  productIds: string[],
) {
  const ids = Array.from(
    new Set(
      productIds
        .map((id) => normalizeShopifyId(id))
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
            collections(first: 30) {
              nodes {
                id
              }
            }
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

function isProductEligibleForQuote(
  productId: string,
  collectionIds: string[],
  settings: {
    productEligibility: string;
    selectedProductResources: string | null | undefined;
    allowedProductResources?: string | null | undefined;
    excludedProductResources?: string | null | undefined;
  },
) {
  if (settings.productEligibility === "ALL") return true;

  const resources = parseSelectedProductResources(
    getProductResourcesForEligibility(settings),
  );
  if (!resources.length) return settings.productEligibility === "EXCLUDED";

  const normalizedProductId = normalizeShopifyId(productId);
  const normalizedCollectionIds = new Set(collectionIds.map(normalizeShopifyId));
  const matchesResource = resources.some((resource) => {
    const normalizedResourceId = normalizeShopifyId(resource.id);
    if (resource.type === "PRODUCT") {
      return normalizedResourceId === normalizedProductId;
    }
    return normalizedCollectionIds.has(normalizedResourceId);
  });

  if (settings.productEligibility === "SELECTED") return matchesResource;
  if (settings.productEligibility === "EXCLUDED") return !matchesResource;

  return true;
}

function getProductResourcesForEligibility(settings: {
  productEligibility: string;
  selectedProductResources?: string | null | undefined;
  allowedProductResources?: string | null | undefined;
  excludedProductResources?: string | null | undefined;
}) {
  if (settings.productEligibility === "EXCLUDED") {
    return settings.excludedProductResources ?? "";
  }

  if (settings.productEligibility === "SELECTED") {
    return settings.allowedProductResources ?? settings.selectedProductResources ?? "";
  }

  return "";
}

async function validateRequesterEligibility(input: RequesterEligibilityInput) {
  const settings = await getQuoteSettings(input.shop);
  if (settings.requesterScope === "ALL") {
    return { allowed: true };
  }

  const selectedCustomers = parseSelectedCustomers(
    settings.selectedCustomerQuery,
  );
  const normalizedEmail = input.customerEmail.trim().toLowerCase();
  const normalizedPhone = input.customerPhone.trim();
  const normalizedCustomerId = normalizeShopifyId(input.customerId);

  const selectedCustomerMatch = selectedCustomers.some((customer) => {
    return (
      normalizeShopifyId(customer.id) === normalizedCustomerId ||
      Boolean(
        normalizedEmail &&
          customer.email &&
          customer.email.toLowerCase() === normalizedEmail,
      ) ||
      Boolean(
        normalizedPhone &&
          customer.phone &&
          phoneDigits(customer.phone) === phoneDigits(normalizedPhone),
      )
    );
  });

  if (selectedCustomerMatch) {
    return { allowed: true };
  }

  if (matchesEmailPatterns(normalizedEmail, settings.emailPatterns)) {
    return { allowed: true };
  }

  if (!input.admin) {
    return {
      allowed: false,
      reason: "This customer is not eligible to request a quote.",
    };
  }

  const profile = await loadCustomerSegmentProfile(input.admin, {
    customerId: input.customerId,
    email: normalizedEmail,
    phone: normalizedPhone,
  });

  if (!profile) {
    return {
      allowed:
        Boolean(normalizedEmail) && Boolean(settings.allowCustomersNoPurchase),
      reason: "This customer is not eligible to request a quote.",
    };
  }

  if (settings.allowCustomersNoPurchase && profile.ordersCount === 0) {
    return { allowed: true };
  }

  if (settings.allowRepeatCustomers && profile.ordersCount > 1) {
    return { allowed: true };
  }

  if (settings.allowPurchasedCustomers && profile.ordersCount >= 1) {
    return { allowed: true };
  }

  if (settings.allowEmailSubscribers && profile.acceptsEmailMarketing) {
    return { allowed: true };
  }

  if (
    settings.allowAbandonedCheckout &&
    (await hasRecentAbandonedCheckout(input.admin, profile.email || normalizedEmail))
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "This customer is not eligible to request a quote.",
  };
}

function parseSelectedProductResources(value: string | null | undefined) {
  if (!value) return [] as SelectedProductResource[];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((resource): SelectedProductResource | null => {
        if (!resource || typeof resource !== "object") return null;
        const record = resource as Record<string, unknown>;
        const id = String(record.id ?? "");
        const type = String(record.type ?? "").toUpperCase();
        if (!id || (type !== "PRODUCT" && type !== "COLLECTION")) return null;

        return {
          id,
          type,
          title: String(record.title ?? ""),
        } as SelectedProductResource;
      })
      .filter(
        (resource): resource is SelectedProductResource => Boolean(resource),
      );
  } catch {
    return [];
  }
}

function parseSelectedCustomers(value: string | null | undefined) {
  if (!value) return [] as SelectedCustomer[];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((customer): SelectedCustomer | null => {
        if (!customer || typeof customer !== "object") return null;
        const record = customer as Record<string, unknown>;
        const id = String(record.id ?? "");
        if (!id) return null;

        return {
          id,
          name: String(record.name ?? ""),
          email: String(record.email ?? ""),
          phone: String(record.phone ?? ""),
        };
      })
      .filter((customer): customer is SelectedCustomer => Boolean(customer));
  } catch {
    return [];
  }
}

function normalizeShopifyId(id: string) {
  return String(id || "").split("/").pop() ?? "";
}

async function authorizeQuoteCustomer(input: {
  admin?: AdminGraphqlClient;
  customerId: string | null;
  quote: {
    customerId: string | null;
    customerEmail: string | null;
  };
}) {
  const loggedInCustomerId = normalizeShopifyId(input.customerId ?? "");
  if (!loggedInCustomerId) {
    return json(
      { error: "Please log in to view this quote." },
      { status: 401 },
    );
  }

  if (!input.admin) {
    return json(
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
    {
      variables: {
        id: `gid://shopify/Customer/${loggedInCustomerId}`,
      },
    },
  );
  const result = await response.json();
  const customer = result.data?.customer as
    | { id?: string; email?: string | null }
    | null
    | undefined;
  if (!customer?.id) {
    return json({ error: "Customer account not found." }, { status: 403 });
  }

  const quoteCustomerId = normalizeShopifyId(input.quote.customerId ?? "");
  const idMatches = !quoteCustomerId || quoteCustomerId === loggedInCustomerId;
  const quoteEmail = input.quote.customerEmail?.trim().toLowerCase() ?? "";
  const loggedInEmail = customer.email?.trim().toLowerCase() ?? "";
  const emailMatches = !quoteEmail || quoteEmail === loggedInEmail;

  if (!idMatches || !emailMatches) {
    return json(
      { error: "This quote belongs to a different customer account." },
      { status: 403 },
    );
  }

  return null;
}

function matchesEmailPatterns(email: string, patterns: string | null | undefined) {
  if (!email || !patterns) return false;

  return patterns
    .split(/[\n,]+/)
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern.startsWith("@")) return email.endsWith(pattern);
      const escaped = pattern
        .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`, "i").test(email);
    });
}

async function loadCustomerSegmentProfile(
  admin: AdminGraphqlClient,
  contact: { customerId: string; email: string; phone: string },
) {
  const gid = contact.customerId
    ? `gid://shopify/Customer/${normalizeShopifyId(contact.customerId)}`
    : "";
  const customer = gid
    ? await loadCustomerById(admin, gid)
    : await findCustomerByContact(admin, contact.email, contact.phone);
  if (!customer?.id) return null;

  const response = await admin.graphql(
    `#graphql
      query QuoteRequesterCustomerProfile($id: ID!) {
        customer(id: $id) {
          id
          defaultEmailAddress {
            emailAddress
          }
          defaultPhoneNumber {
            phoneNumber
          }
          numberOfOrders
          emailMarketingConsent {
            marketingState
          }
        }
      }`,
    { variables: { id: customer.id } },
  );
  const result = await response.json();
  const node = result.data?.customer;
  if (!node) return null;

  return {
    id: String(node.id ?? ""),
    email: String(node.defaultEmailAddress?.emailAddress ?? customer.email ?? ""),
    phone: String(node.defaultPhoneNumber?.phoneNumber ?? customer.phone ?? ""),
    ordersCount: Number(node.numberOfOrders ?? 0),
    acceptsEmailMarketing:
      String(node.emailMarketingConsent?.marketingState ?? "").toUpperCase() ===
      "SUBSCRIBED",
  } satisfies CustomerSegmentProfile;
}

async function loadCustomerById(admin: AdminGraphqlClient, id: string) {
  const response = await admin.graphql(
    `#graphql
      query FindQuoteCustomerById($id: ID!) {
        customer(id: $id) {
          id
          displayName
          defaultEmailAddress {
            emailAddress
          }
          defaultPhoneNumber {
            phoneNumber
          }
        }
      }`,
    { variables: { id } },
  );
  const result = await response.json();
  const customer = result.data?.customer;
  if (!customer) return null;

  return {
    id: String(customer.id ?? ""),
    name: String(customer.displayName ?? ""),
    email: String(customer.defaultEmailAddress?.emailAddress ?? ""),
    phone: String(customer.defaultPhoneNumber?.phoneNumber ?? ""),
  };
}

async function hasRecentAbandonedCheckout(
  admin: AdminGraphqlClient,
  email: string,
) {
  if (!email) return false;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  try {
    const response = await admin.graphql(
      `#graphql
        query RecentAbandonedCheckouts($query: String!) {
          abandonedCheckouts(first: 1, query: $query) {
            nodes {
              id
            }
          }
        }`,
      {
        variables: {
          query: `email:"${customerSearchValue(email)}" created_at:>=${since
            .toISOString()
            .slice(0, 10)}`,
        },
      },
    );
    const result = await response.json();
    if (result.errors) {
      console.warn("[SP RFQ] Could not evaluate abandoned checkout segment.", {
        errors: result.errors,
      });
      return false;
    }
    return Boolean(result.data?.abandonedCheckouts?.nodes?.length);
  } catch (error) {
    console.warn("[SP RFQ] Could not evaluate abandoned checkout segment.", error);
    return false;
  }
}

function customerSearchValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findCustomerByContact(
  admin: AdminGraphqlClient,
  email: string,
  phone: string,
) {
  const filters = [
    email ? `email:"${customerSearchValue(email)}"` : "",
    phone ? `phone:"${customerSearchValue(phone)}"` : "",
  ].filter(Boolean);

  if (!filters.length) return null;

  const response = await admin.graphql(
    `#graphql
      query FindQuoteCustomer($query: String!) {
        customers(first: 5, query: $query) {
          nodes {
            id
            displayName
            defaultEmailAddress {
              emailAddress
            }
            defaultPhoneNumber {
              phoneNumber
            }
          }
        }
      }`,
    {
      variables: {
        query: filters.join(" OR "),
      },
    },
  );
  const result = await response.json();
  const customers = result.data?.customers?.nodes ?? [];
  const customer =
    customers.find(
      (node: {
        defaultPhoneNumber?: { phoneNumber?: string | null } | null;
      }) =>
        phone &&
        node.defaultPhoneNumber?.phoneNumber &&
        phoneDigits(node.defaultPhoneNumber.phoneNumber) === phoneDigits(phone),
    ) ||
    customers.find(
      (node: {
        defaultEmailAddress?: { emailAddress?: string | null } | null;
      }) =>
        email &&
        node.defaultEmailAddress?.emailAddress &&
        node.defaultEmailAddress.emailAddress.toLowerCase() === email.toLowerCase(),
    ) ||
    customers[0];
  if (!customer) return null;

  return {
    id: String(customer.id ?? ""),
    name: String(customer.displayName ?? ""),
    email: String(customer.defaultEmailAddress?.emailAddress ?? ""),
    phone: String(customer.defaultPhoneNumber?.phoneNumber ?? ""),
  };
}

function normalizeAttachments(attachments: unknown) {
  const files = Array.isArray(attachments)
    ? attachments
    : attachments
      ? [attachments]
      : [];

  return files
    .filter((attachment): attachment is Record<string, unknown> => {
      return Boolean(attachment) && typeof attachment === "object";
    })
    .map((file) => {
      const fileName = String(file.name ?? file.fileName ?? "").trim();
      if (!fileName) return null;
      return {
        fileName,
        fileUrl: String(
          file.fileUrl ??
            file.dataUrl ??
            file.preview ??
            `local://${encodeURIComponent(fileName)}`,
        ),
        mimeType: [
          String(file.type ?? file.mimeType ?? "").split(";")[0],
          Number(file.size) > 0 ? `size=${Number(file.size)}` : "",
        ]
          .filter(Boolean)
          .join(";"),
      };
    })
    .filter((file): file is NonNullable<typeof file> => Boolean(file));
}

function storefrontWidgetSettings(settings: Awaited<ReturnType<typeof getQuoteSettings>>) {
  return {
    widgetStyle: settings.widgetStyle,
    widgetButtonText: settings.widgetButtonText,
    widgetSize: settings.widgetSize,
    widgetOrientation: settings.widgetOrientation,
    widgetDesktopPosition: settings.widgetDesktopPosition,
    widgetMobilePosition: settings.widgetMobilePosition,
    widgetDisplayMode: settings.widgetDisplayMode,
    widgetSpecificPages: settings.widgetSpecificPages,
    widgetBackgroundColor: settings.widgetBackgroundColor,
    widgetTextColor: settings.widgetTextColor,
    widgetAnimation: settings.widgetAnimation,
    widgetIconDataUrl: settings.widgetIconDataUrl,
  };
}
