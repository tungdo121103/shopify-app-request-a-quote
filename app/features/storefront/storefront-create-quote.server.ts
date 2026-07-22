import { createStorefrontQuote } from "~/models/quote.server";
import { isValidE164Phone, isValidEmail } from "~/lib/contact-validation";
import { normalizeStorefrontAttachments } from "~/features/storefront/storefront-attachments";
import { validateRequesterEligibility } from "~/features/storefront/storefront-customer.server";
import { validateQuoteItemsProductEligibility } from "~/features/storefront/storefront-product-eligibility.server";
import { storefrontJson } from "~/features/storefront/storefront-response.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";

type CreateQuoteInput = {
  admin?: AdminGraphqlClient;
  body: Record<string, unknown>;
  customerId: string;
  shop: string;
};

export async function handleStorefrontCreateQuote(input: CreateQuoteInput) {
  const items = input.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return storefrontJson({ error: "At least one quote item is required" }, { status: 400 });
  }

  const customerEmail = String(input.body.customerEmail ?? "").trim().toLowerCase();
  const customerPhone = String(input.body.customerPhone ?? "").trim();
  if (!input.customerId && !isValidEmail(customerEmail)) {
    return storefrontJson({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (customerPhone && !isValidE164Phone(customerPhone)) {
    return storefrontJson({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  const requesterEligibility = await validateRequesterEligibility({
    admin: input.admin,
    shop: input.shop,
    customerId: input.customerId,
    customerEmail,
    customerPhone,
  });
  if (!requesterEligibility.allowed) {
    return storefrontJson(
      {
        code: "NOT_ELIGIBLE_TO_REQUEST_QUOTE",
        message: "Your account is not eligible to request quotes.",
        error: requesterEligibility.reason,
      },
      { status: 403 },
    );
  }

  const productEligibility = await validateQuoteItemsProductEligibility({
    admin: input.admin,
    shop: input.shop,
    items,
  });
  if (!productEligibility.allowed) {
    return storefrontJson(
      {
        code: "PRODUCT_NOT_ELIGIBLE_FOR_QUOTE",
        message: productEligibility.reason,
        error: productEligibility.reason,
      },
      { status: 400 },
    );
  }

  const quote = await createStorefrontQuote({
    shop: input.shop,
    customerId: input.customerId,
    customerName: String(input.body.customerName ?? ""),
    customerEmail,
    customerPhone,
    customerCountry: String(input.body.customerCountry ?? ""),
    customerRegion: String(input.body.customerRegion ?? ""),
    customerAddress: String(input.body.customerAddress ?? ""),
    currency: String(input.body.currency ?? "USD"),
    note: String(input.body.note ?? ""),
    items: items.map((item) => {
      const quoteItem = item as Record<string, unknown>;
      return {
        productId: String(quoteItem.productId ?? ""),
        variantId: String(quoteItem.variantId ?? ""),
        variantTitle: String(quoteItem.variantTitle ?? ""),
        title: String(quoteItem.title ?? "Product"),
        imageUrl: String(quoteItem.imageUrl ?? ""),
        quantity: Math.max(1, Number(quoteItem.quantity ?? 1)),
        unitPrice: Math.max(0, Number(quoteItem.unitPrice ?? 0)),
        quotePrice: Math.max(0, Number(quoteItem.quotePrice ?? quoteItem.unitPrice ?? 0)),
        inventoryStatus: String(quoteItem.inventoryStatus ?? "AVAILABLE"),
      };
    }),
    attachments: normalizeStorefrontAttachments(
      input.body.attachments ?? input.body.attachment,
    ),
  });
  return storefrontJson({ quote }, { status: 201 });
}
