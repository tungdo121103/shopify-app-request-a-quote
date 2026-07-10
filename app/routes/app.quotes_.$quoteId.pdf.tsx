import type { LoaderFunctionArgs } from "react-router";
import { createQuotePdf } from "~/lib/quote-pdf.server";
import { getQuote } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

const safeFileName = (value: string) =>
  value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-");

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quote = await getQuote(session.shop, params.quoteId ?? "");
  if (!quote) throw new Response("Quote not found", { status: 404 });

  const pdf = createQuotePdf(quote);
  const fileName = `${safeFileName(quote.quoteNumber)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
};
