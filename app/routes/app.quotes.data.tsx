import type { LoaderFunctionArgs } from "react-router";
import { getQuoteListData } from "~/models/quote-list.server";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = await getQuoteListData(session.shop, request);

  return json(data);
};
