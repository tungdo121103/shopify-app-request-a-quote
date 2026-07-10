import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  runAllQuoteExpirationJobs,
  runQuoteExpirationJobs,
} from "~/models/quote.server";

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });

function assertJobAuthorized(request: Request) {
  const configuredSecret = process.env.QUOTE_JOB_SECRET;

  if (!configuredSecret && process.env.NODE_ENV === "production") {
    throw json(
      { ok: false, error: "QUOTE_JOB_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (!configuredSecret) return;

  const url = new URL(request.url);
  const providedSecret =
    request.headers.get("x-quote-job-secret") ??
    url.searchParams.get("secret");

  if (providedSecret !== configuredSecret) {
    throw json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

async function runJob(request: Request) {
  assertJobAuthorized(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")?.trim();
  const quoteId = url.searchParams.get("quoteId")?.trim() || undefined;

  if (shop) {
    const result = await runQuoteExpirationJobs({
      shop,
      quoteId,
      includeReminders: true,
    });
    return json({ ok: true, shop, ...result });
  }

  const result = await runAllQuoteExpirationJobs();
  return json({ ok: true, ...result });
}

export const loader = async ({ request }: LoaderFunctionArgs) => runJob(request);

export const action = async ({ request }: ActionFunctionArgs) => runJob(request);
