import {
  createQuotePdfDownload,
  createQuotePdfDownloadResponse,
} from "~/features/pdf/quote-pdf-download.server";
import { verifyQuotePortalToken } from "~/features/email/quote-email.server";
import { getQuote, listCustomerQuotes, markQuoteRead } from "~/models/quote.server";
import { storefrontJson } from "~/features/storefront/storefront-response.server";
import { authorizeQuoteCustomer } from "~/features/storefront/storefront-customer-access.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";

type QuoteReadInput = {
  admin?: AdminGraphqlClient;
  customerEmail: string;
  customerId: string | null;
  path: string;
  shop: string;
  url: URL;
};

export async function handleStorefrontQuoteRead(input: QuoteReadInput) {
  if (/^quotes\/[^/]+\/pdf$/.test(input.path)) {
    return downloadBuyerQuotePdf(input);
  }

  if (input.path.startsWith("quotes/")) {
    return loadBuyerQuoteDetail(input);
  }

  if (!input.customerId && !input.customerEmail) {
    return storefrontJson({ quotes: [] });
  }
  const quotes = await listCustomerQuotes(
    input.shop,
    input.customerId ?? "",
    input.customerEmail,
  );
  return storefrontJson({ quotes });
}

async function loadBuyerQuoteDetail(input: QuoteReadInput) {
  const quoteId = input.path.split("/")[1];
  const quote = await getQuote(input.shop, quoteId);
  if (!quote) return storefrontJson({ error: "Quote not found" }, { status: 404 });

  const portalError = validatePortalToken(input.url, input.shop, quoteId);
  if (portalError) return portalError;
  const accessError = await authorizeQuoteCustomer({
    admin: input.admin,
    customerId: input.customerId,
    quote,
  });
  if (accessError) return accessError;

  if (input.customerId) {
    await markQuoteRead({
      shop: input.shop,
      quoteId: quote.id,
      viewer: "CUSTOMER",
      viewerId: input.customerId,
    });
  }
  return storefrontJson({ quote });
}

async function downloadBuyerQuotePdf(input: QuoteReadInput) {
  const quoteId = input.path.split("/")[1];
  const quote = await getQuote(input.shop, quoteId);
  if (!quote) return storefrontJson({ error: "Quote not found" }, { status: 404 });

  const portalError = validatePortalToken(input.url, input.shop, quoteId);
  if (portalError) return portalError;
  const accessError = await authorizeQuoteCustomer({
    admin: input.admin,
    customerId: input.customerId,
    quote,
  });
  if (accessError) return accessError;

  const download = await createQuotePdfDownload(input.shop, quote);
  return createQuotePdfDownloadResponse(download);
}

function validatePortalToken(url: URL, shop: string, quoteId: string) {
  const portalToken = url.searchParams.get("portalToken") ?? "";
  if (portalToken && !verifyQuotePortalToken(portalToken, shop, quoteId)) {
    return storefrontJson({ error: "Invalid quote link" }, { status: 403 });
  }
  return null;
}
