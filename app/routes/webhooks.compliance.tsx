import type { ActionFunctionArgs } from "react-router";
import {
  createCustomerDataExport,
  deleteShopData,
  redactCustomerData,
} from "~/models/privacy.server";
import { authenticate } from "~/shopify.server";

type CompliancePayload = {
  customer?: { id?: string | number | null; email?: string | null };
  data_request?: { id?: string | number | null };
};

function normalizeTopic(topic: string) {
  return topic.toLowerCase().replaceAll("_", "/");
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const normalizedTopic = normalizeTopic(String(topic));
  const body = (payload ?? {}) as CompliancePayload;

  switch (normalizedTopic) {
    case "customers/data/request":
    case "customers/data_request": {
      const requestId = String(
        body.data_request?.id ??
          request.headers.get("x-shopify-webhook-id") ??
          `${shop}:${body.customer?.id ?? body.customer?.email ?? "unknown"}`,
      );
      await createCustomerDataExport({
        shop,
        requestId,
        customer: body.customer ?? {},
      });
      break;
    }
    case "customers/redact":
      await redactCustomerData({ shop, customer: body.customer ?? {} });
      break;
    case "shop/redact":
      await deleteShopData(shop);
      break;
    default:
      return new Response("Unsupported compliance topic", { status: 400 });
  }

  return new Response(null, { status: 200 });
};
