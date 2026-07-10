import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.toString();

  return redirect(`/app/quotes${query ? `?${query}` : ""}`);
};

export default function AppIndex() {
  return null;
}
