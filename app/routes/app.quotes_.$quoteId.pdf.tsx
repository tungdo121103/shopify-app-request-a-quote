import type { LoaderFunctionArgs } from "react-router";
import {
  createQuotePdfDownload,
  createQuotePdfDownloadResponse,
} from "~/features/pdf/quote-pdf-download.server";
import { getQuote } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quote = await getQuote(session.shop, params.quoteId ?? "");
  if (!quote) throw new Response("Quote not found", { status: 404 });

  const download = await createQuotePdfDownload(session.shop, quote);
  return createQuotePdfDownloadResponse(download, "no-store");
};
