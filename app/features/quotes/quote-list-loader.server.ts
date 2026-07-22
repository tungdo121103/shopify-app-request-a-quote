import type { LoaderFunctionArgs } from "react-router";
import { getQuoteListData } from "~/models/quote-list.server";
import { authenticate } from "~/shopify.server";

export async function handleQuoteListLoader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return getQuoteListData(session.shop, request);
}
