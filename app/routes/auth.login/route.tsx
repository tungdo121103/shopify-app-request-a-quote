import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";

import { login } from "~/shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (!url.searchParams.get("shop") && process.env.NODE_ENV !== "production") {
    const devShop =
      process.env.SHOPIFY_DEV_STORE ??
      "test-shop-234576183295487458566.myshopify.com";

    throw redirect(`/auth/login?shop=${encodeURIComponent(devShop)}`);
  }

  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <form action="/auth/login" method="get" target="_top">
          <s-section heading="Log in">
            <label
              htmlFor="shop"
              style={{ display: "block", marginBottom: "6px" }}
            >
              Shop domain
            </label>
            <input
              id="shop"
              name="shop"
              placeholder="example.myshopify.com"
              autoComplete="on"
              required
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "42px",
                border: "1px solid #8a8a8a",
                borderRadius: "8px",
                padding: "8px 12px",
                font: "inherit",
              }}
            />
            {errors.shop ? (
              <p style={{ color: "#b42318", margin: "6px 0 0" }}>
                {errors.shop}
              </p>
            ) : (
              <p style={{ color: "#616161", margin: "6px 0 0" }}>
                example.myshopify.com
              </p>
            )}
            <button
              type="submit"
              style={{
                marginTop: "14px",
                border: "1px solid #8a8a8a",
                borderRadius: "8px",
                padding: "8px 14px",
                background: "#fff",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Log in
            </button>
          </s-section>
        </form>
      </s-page>
    </AppProvider>
  );
}
