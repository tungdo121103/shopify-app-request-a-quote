import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { deleteShopData } from "~/models/privacy.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Idempotent: Shopify may retry this webhook after the data is already gone.
  await deleteShopData(shop);

  return new Response();
};
