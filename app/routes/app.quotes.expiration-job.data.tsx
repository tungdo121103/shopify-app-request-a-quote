import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { runQuoteExpirationJobs } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });

async function runJob(request: Request) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const quoteId = url.searchParams.get("quoteId") || undefined;
  const result = await runQuoteExpirationJobs({
    shop: session.shop,
    quoteId,
    includeReminders: true,
  });

  return json({ ok: true, ...result });
}

export const loader = async ({ request }: LoaderFunctionArgs) => runJob(request);

export const action = async ({ request }: ActionFunctionArgs) => runJob(request);
