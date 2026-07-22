import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";

import {
  runAllQuoteExpirationJobs,
  runQuoteExpirationJobs,
} from "~/models/quote.server";
import { processQuoteEmailDeliveries } from "~/features/email/quote-email.server";

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

  if (!configuredSecret) {
    throw json(
      { ok: false, error: "QUOTE_JOB_SECRET is not configured." },
      { status: 500 },
    );
  }

  const providedSecret = request.headers.get("x-quote-job-secret") ?? "";
  const configured = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  const authorized =
    configured.length === provided.length &&
    timingSafeEqual(configured, provided);

  if (!authorized) {
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
    const emailResult = await processQuoteEmailDeliveries();
    return json({ ok: true, shop, ...result, email: emailResult });
  }

  const result = await runAllQuoteExpirationJobs();
  const emailResult = await processQuoteEmailDeliveries();
  return json({ ok: true, ...result, email: emailResult });
}

export const loader = async (args: LoaderFunctionArgs) => {
  void args;
  return json(
    { ok: false, error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => runJob(request);
