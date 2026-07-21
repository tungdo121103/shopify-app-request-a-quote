import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const downloadId = url.searchParams.get("download");
  if (downloadId) {
    const privacyRequest = await prisma.privacyRequest.findFirst({
      where: { id: downloadId, shop: session.shop },
    });
    if (!privacyRequest) throw new Response("Privacy request not found", { status: 404 });
    return new Response(privacyRequest.payloadJson, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="customer-data-${privacyRequest.id.replace(/[^a-z0-9_-]/gi, "-")}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const requests = await prisma.privacyRequest.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      topic: true,
      customerEmail: true,
      customerId: true,
      status: true,
      createdAt: true,
    },
  });
  return { requests };
};

export default function PrivacyRequestsPage() {
  const { requests } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Privacy requests" inlineSize="large">
      <s-section>
        <s-paragraph>
          Customer data exports requested through Shopify appear here for the merchant to download.
        </s-paragraph>
        {requests.length ? (
          <s-stack direction="block" gap="base">
            {requests.map((request) => (
              <s-box key={request.id} border="base" borderRadius="base" padding="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-stack direction="block" gap="small-200">
                    <s-heading>{request.customerEmail || request.customerId || "Customer"}</s-heading>
                    <s-text>{new Date(request.createdAt).toLocaleString()}</s-text>
                  </s-stack>
                  <s-button href={`/app/privacy?download=${encodeURIComponent(request.id)}`}>
                    Download JSON
                  </s-button>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No customer data requests have been received.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}
