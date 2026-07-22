import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation } from "react-router";
import { WidgetAdminPage } from "~/components/widget/WidgetAdminPage";
import {
  loadWidgetAdmin,
  saveWidgetAdmin,
} from "~/features/widget/widget-admin.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return loadWidgetAdmin(session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveWidgetAdmin(session.shop, await request.formData());
};

export default function WidgetPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <WidgetAdminPage
      actionData={actionData}
      isSubmitting={navigation.state === "submitting"}
      settings={settings}
    />
  );
}
