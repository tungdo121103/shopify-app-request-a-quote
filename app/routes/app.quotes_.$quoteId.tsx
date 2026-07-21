import type { LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
  useSearchParams,
} from "react-router";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { QuoteDetailHeader } from "~/components/quotes/QuoteDetailHeader";
import { QuoteInformationCard } from "~/components/quotes/QuoteInformationCard";
import { QuoteItemsTable } from "~/components/quotes/QuoteItemsTable";
import { QuoteConversation } from "~/components/quotes/QuoteConversation";
import {
  getQuote,
  markQuoteRead,
} from "~/models/quote.server";
import { handleQuoteDetailAction } from "~/features/quotes/quote-detail-action.server";
import { authenticate } from "~/shopify.server";
import pageStyles from "~/styles/quote-detail.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type AdminProductSearchItem = {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  imageUrl: string;
};

type AdminProductSearchData = {
  products: AdminProductSearchItem[];
};



async function getLiveCustomerInfo(admin: unknown, customerId?: string | null) {
  if (!customerId) return null;
  const numericId = customerId.split("/").pop();
  if (!numericId) return null;

  try {
    const response = await (
      admin as {
        graphql: (
          query: string,
          options: { variables: Record<string, string> },
        ) => Promise<Response>;
      }
    ).graphql(
      `#graphql
        query QuoteCustomer($id: ID!) {
          customer(id: $id) {
            displayName
            firstName
            lastName
            defaultEmailAddress {
              emailAddress
            }
            defaultPhoneNumber {
              phoneNumber
            }
            defaultAddress {
              firstName
              lastName
              address1
              city
              province
              country
            }
          }
        }
      `,
      {
        variables: { id: `gid://shopify/Customer/${numericId}` },
      },
    );
    const payload = (await response.json()) as {
      data?: {
        customer?: {
          displayName?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          defaultEmailAddress?: { emailAddress?: string | null } | null;
          defaultPhoneNumber?: { phoneNumber?: string | null } | null;
          defaultAddress?: {
            firstName?: string | null;
            lastName?: string | null;
            address1?: string | null;
            city?: string | null;
            province?: string | null;
            country?: string | null;
          } | null;
        } | null;
      };
    };
    const customer = payload.data?.customer;
    if (!customer) return null;
    const customerProfileName = [customer.firstName, customer.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    const customerAddressName = [
      customer.defaultAddress?.firstName,
      customer.defaultAddress?.lastName,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    const customerEmail =
      customer.defaultEmailAddress?.emailAddress?.trim() || null;
    const customerName =
      customerProfileName ||
      customerAddressName ||
      (hasMeaningfulCustomerName(customer.displayName, customerEmail)
        ? customer.displayName?.trim()
        : null);
    const address = [
      customer.defaultAddress?.address1,
      customer.defaultAddress?.city,
      customer.defaultAddress?.country,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      customerName,
      customerEmail,
      customerPhone: customer.defaultPhoneNumber?.phoneNumber || null,
      customerCountry: customer.defaultAddress?.country || null,
      customerRegion: customer.defaultAddress?.province || null,
      customerAddress: address || null,
    };
  } catch (error) {
    console.warn("[RFQ] Could not load live customer info.", error);
    return null;
  }
}

async function getLiveDraftOrderInfo(
  admin: unknown,
  draftOrderId?: string | null,
) {
  if (!draftOrderId) return null;

  try {
    const response = await (
      admin as {
        graphql: (
          query: string,
          options: { variables: Record<string, string> },
        ) => Promise<Response>;
      }
    ).graphql(
      `#graphql
        query QuoteDraftOrder($id: ID!) {
          draftOrder(id: $id) {
            order {
              id
              name
            }
          }
        }
      `,
      { variables: { id: draftOrderId } },
    );
    const payload = (await response.json()) as {
      data?: {
        draftOrder?: {
          order?: {
            id?: string | null;
            name?: string | null;
          } | null;
        } | null;
      };
    };
    const draftOrder = payload.data?.draftOrder;
    if (!draftOrder) return null;

    return {
      orderId: draftOrder.order?.id || null,
      orderName: draftOrder.order?.name || null,
    };
  } catch (error) {
    console.warn("[RFQ] Could not load live Draft Order info.", error);
    return null;
  }
}

function hasMeaningfulCustomerName(
  customerName?: string | null,
  customerEmail?: string | null,
) {
  const normalizedName = customerName?.trim().toLowerCase() ?? "";
  const normalizedEmail = customerEmail?.trim().toLowerCase() ?? "";

  return Boolean(
    normalizedName &&
      normalizedName !== "demo buyer" &&
      normalizedName !== normalizedEmail &&
      !normalizedName.includes("@"),
  );
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const quote = await getQuote(session.shop, params.quoteId ?? "");
  if (!quote) throw new Response("Quote not found", { status: 404 });
  const [liveCustomer, liveDraftOrder] = await Promise.all([
    getLiveCustomerInfo(admin, quote.customerId),
    getLiveDraftOrderInfo(admin, quote.orderId),
    markQuoteRead({
      shop: session.shop,
      quoteId: quote.id,
      viewer: "MANAGER",
      viewerId: "manager",
    }),
  ]);
  const hydratedQuote = liveCustomer
    ? {
        ...quote,
        customerName: hasMeaningfulCustomerName(
          quote.customerName,
          quote.customerEmail,
        )
          ? quote.customerName
          : liveCustomer.customerName || quote.customerName,
        customerEmail: quote.customerEmail || liveCustomer.customerEmail,
        customerPhone: quote.customerPhone || liveCustomer.customerPhone,
        customerCountry: quote.customerCountry || liveCustomer.customerCountry,
        customerRegion: quote.customerRegion || liveCustomer.customerRegion,
        customerAddress:
          (quote as typeof quote & { customerAddress?: string | null })
            .customerAddress || liveCustomer.customerAddress,
      }
    : quote;

  const shopHandle = session.shop.replace(".myshopify.com", "");
  const draftOrderNumericId = hydratedQuote.orderId?.split("/").pop();
  const orderNumericId = liveDraftOrder?.orderId?.split("/").pop();

  return {
    quote: hydratedQuote,
    draftOrderAdminUrl:
      draftOrderNumericId && hydratedQuote.orderId
        ? `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`
        : null,
    shopifyOrderName: liveDraftOrder?.orderName ?? null,
    shopifyOrderAdminUrl:
      orderNumericId && liveDraftOrder?.orderId
        ? `https://admin.shopify.com/store/${shopHandle}/orders/${orderNumericId}`
        : null,
  };
};


export const action = handleQuoteDetailAction;

const money = (value: string | number | null | undefined, currency: string) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

async function fetchAdminProducts(
  pathname: string,
  currentSearch: string,
  query: string,
) {
  const params = new URLSearchParams(currentSearch);
  params.set("q", query);
  const response = await fetch(`${pathname}/products?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Could not load products: HTTP ${response.status}`);
  }

  return (await response.json()) as AdminProductSearchData;
}

const shortDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value || Date.now()));


const currencyNames: Record<string, string> = {
  CAD: "Canadian Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  USD: "US Dollar",
  VND: "Vietnamese Dong",
};

export default function QuoteDetailsPage() {
  const {
    quote,
    draftOrderAdminUrl,
    shopifyOrderName,
    shopifyOrderAdminUrl,
  } = useLoaderData<typeof loader>() as Awaited<ReturnType<typeof loader>> & {
    quote: NonNullable<Awaited<ReturnType<typeof loader>>["quote"]>;
    draftOrderAdminUrl: string | null;
    shopifyOrderName: string | null;
    shopifyOrderAdminUrl: string | null;
  };
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<
    AdminProductSearchItem[]
  >([]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            placeholderData: (previousData: unknown) => previousData,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5000,
          },
        },
      }),
  );
  const itemSearchRef = useRef<HTMLInputElement>(null);
  const productSearchAreaRef = useRef<HTMLDivElement>(null);
  const firstQuotePriceInputRef = useRef<HTMLInputElement>(null);
  const draftOrderWindowRef = useRef<Window | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const productsQuery = useQuery<AdminProductSearchData>(
    {
      enabled: isProductDropdownOpen,
      queryKey: [
        "admin-quote-products",
        location.pathname,
        location.search,
        debouncedItemSearch,
      ],
      queryFn: () =>
        fetchAdminProducts(
          location.pathname,
          location.search,
          debouncedItemSearch,
        ),
      placeholderData: (previousData) => previousData,
    },
    queryClient,
  );
  const mode = searchParams.get("mode") ?? "";
  const focus = searchParams.get("focus") ?? "";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit" || (!mode && !focus);
  const isChatMode = focus === "chat";
  const isLockedStatus =
    quote.status === "OFFERED_BY_MERCHANT" ||
    quote.status === "ACCEPTED" ||
    quote.status === "DECLINED" ||
    String(quote.status) === "EXPIRED" ||
    quote.status === "CONVERTED_TO_ORDER";
  const isPriceReadOnly = isViewMode || isLockedStatus || Boolean(quote.orderId);
  const canSendOffer =
    quote.status === "REQUESTED_BY_CUSTOMER" ||
    quote.status === "NEGOTIATING";
  const canReopen =
    quote.status === "DECLINED" || String(quote.status) === "EXPIRED";
  const canRevise = quote.status === "OFFERED_BY_MERCHANT";
  const canConvert = quote.status === "ACCEPTED" && !quote.orderId;
  const pdfSearch = new URLSearchParams(location.search);
  pdfSearch.delete("mode");
  pdfSearch.delete("focus");
  const pdfQuery = pdfSearch.toString();
  const pdfHref = `/app/quotes/${quote.id}/pdf${pdfQuery ? `?${pdfQuery}` : ""}`;
  const editSearch = new URLSearchParams(location.search);
  editSearch.set("mode", "edit");
  editSearch.delete("focus");
  const editAction = `${location.pathname}?${editSearch.toString()}`;
  const quoteCustomer = quote as typeof quote & {
    customerPhone?: string | null;
    customerCountry?: string | null;
    customerRegion?: string | null;
    customerAddress?: string | null;
  };
  const customerLabel =
    quote.customerName || quote.customerEmail || "Guest customer";
  const customerMarket = [
    quoteCustomer.customerCountry,
    quoteCustomer.customerRegion,
  ]
    .filter(Boolean)
    .join(" / ");
  const customerAddress = quoteCustomer.customerAddress || customerMarket;
  const currencyLabel = `${currencyNames[quote.currency] ?? quote.currency} (${
    quote.currency
  })`;
  const filteredItems = useMemo(() => {
    const query = debouncedItemSearch.trim().toLowerCase();
    if (!query) return quote.items;
    return quote.items.filter((item) => {
      return [item.title, item.sku, item.productId, item.variantId]
        .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [debouncedItemSearch, quote.items]);
  const existingProductKeys = useMemo(
    () =>
      new Set(
        quote.items.flatMap((item) =>
          [item.variantId, item.productId].filter(Boolean).map(String),
        ),
      ),
    [quote.items],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [itemSearch]);

  useEffect(() => {
    if (actionData?.ok && actionData.message === "Products added to quote.") {
      setIsProductDropdownOpen(false);
      setItemSearch("");
      setSelectedProducts([]);
    }
  }, [actionData]);

  useEffect(() => {
    if (!actionData) return;
    if (
      actionData.ok &&
      "draftOrderAdminUrl" in actionData &&
      actionData.draftOrderAdminUrl
    ) {
      setIsToastVisible(false);
      const draftOrderWindow = draftOrderWindowRef.current;
      if (draftOrderWindow && !draftOrderWindow.closed) {
        draftOrderWindow.opener = null;
        draftOrderWindow.location.replace(actionData.draftOrderAdminUrl);
      } else {
        window.open(
          actionData.draftOrderAdminUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }
      draftOrderWindowRef.current = null;
      return;
    }
    if (!actionData.ok && draftOrderWindowRef.current) {
      draftOrderWindowRef.current.close();
      draftOrderWindowRef.current = null;
    }
    if (actionData.ok && "chatMessage" in actionData) {
      setIsToastVisible(false);
      return;
    }

    setIsToastVisible(true);
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [actionData]);

  useEffect(() => {
    if (!isProductDropdownOpen) return;
    const closeProductDropdown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (productSearchAreaRef.current?.contains(target)) return;
      setIsProductDropdownOpen(false);
    };

    document.addEventListener("mousedown", closeProductDropdown);
    return () => {
      document.removeEventListener("mousedown", closeProductDropdown);
    };
  }, [isProductDropdownOpen]);

  useEffect(() => {
    if (isEditMode) {
      firstQuotePriceInputRef.current?.focus();
    }
  }, [isEditMode]);

  return (
    <main className={styles.quoteDetailPage}>
      <section
        className={`${styles.quoteDetailShell} ${
          isViewMode ? styles.quoteDetailShellReadonly : ""
        }`}
      >
<QuoteDetailHeader
          canConvert={canConvert}
          canReopen={canReopen}
          canRevise={canRevise}
          canSendOffer={canSendOffer}
          editAction={editAction}
          isSubmitting={isSubmitting}
          isViewMode={isViewMode}
          onConvertStart={() => {
            draftOrderWindowRef.current = window.open("about:blank", "_blank");
          }}
          pdfHref={pdfHref}
          quoteNumber={quote.quoteNumber}
          status={quote.status}
        />

        {actionData &&
          isToastVisible &&
          !(actionData.ok && "chatMessage" in actionData) && (
          <div
            className={`${styles.quoteToast} ${
              actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError
            }`}
            role="status"
          >
            {actionData.ok ? actionData.message : actionData.error}
          </div>
        )}

        <div className={styles.merchantQuoteGrid}>
          <div className={styles.merchantQuoteLeft}>
            <QuoteInformationCard
              createdDate={shortDateTime(quote.createdAt)}
              currencyLabel={currencyLabel}
              customerAddress={customerAddress}
              customerEmail={quote.customerEmail ?? ""}
              customerLabel={customerLabel}
              customerMarket={customerMarket}
              customerPhone={quoteCustomer.customerPhone ?? ""}
              draftOrderAdminUrl={draftOrderAdminUrl ?? ""}
              draftOrderName={quote.orderName ?? ""}
              orderAdminUrl={shopifyOrderAdminUrl ?? ""}
              orderName={shopifyOrderName ?? ""}
              quoteNumber={quote.quoteNumber}
            />

            <section
              className={`${styles.merchantItemsCard} ${
                isEditMode ? styles.merchantPanelActive : ""
              }`}
            >
              <h2>Quote Items</h2>
              <div
                className={styles.merchantProductSearchArea}
                ref={productSearchAreaRef}
              >
                <div className={styles.merchantItemsToolbar}>
                  <input
                    disabled={isViewMode || isLockedStatus}
                    onChange={(event) => {
                      setItemSearch(event.currentTarget.value);
                    }}
                    placeholder="Search products"
                    ref={itemSearchRef}
                    type="search"
                    value={itemSearch}
                  />
                  <button
                    disabled={isViewMode || isLockedStatus || Boolean(quote.orderId)}
                    onClick={() => {
                      setIsProductDropdownOpen(true);
                      itemSearchRef.current?.focus();
                    }}
                    title="Browse products"
                    type="button"
                  >
                    Browse
                  </button>
                </div>
                {isProductDropdownOpen && (
                  <div className={styles.merchantProductDropdown}>
                    {productsQuery.isFetching && !productsQuery.data ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        Searching products...
                      </p>
                    ) : productsQuery.isError ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        Could not load products.
                      </p>
                    ) : (productsQuery.data?.products ?? []).length === 0 ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        No products found.
                      </p>
                    ) : (
                      productsQuery.data?.products.map((product) => {
                        const isAlreadyAdded =
                          existingProductKeys.has(product.variantId) ||
                          existingProductKeys.has(product.productId);
                        const isSelected = selectedProducts.some(
                          (selectedProduct) =>
                            selectedProduct.variantId === product.variantId,
                        );

                        return (
                          <button
                            className={`${styles.merchantProductDropdownItem} ${
                              isSelected
                                ? styles.merchantProductDropdownItemSelected
                                : ""
                            } ${
                              isAlreadyAdded
                                ? styles.merchantProductDropdownItemAdded
                                : ""
                            }`}
                            disabled={isAlreadyAdded}
                            key={product.variantId}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              setSelectedProducts((currentProducts) =>
                                isSelected
                                  ? currentProducts.filter(
                                      (selectedProduct) =>
                                        selectedProduct.variantId !==
                                        product.variantId,
                                    )
                                  : [...currentProducts, product],
                              );
                            }}
                            type="button"
                          >
                            {product.imageUrl ? (
                              <img alt="" src={product.imageUrl} />
                            ) : (
                              <span>{product.title.slice(0, 1)}</span>
                            )}
                            <strong>{product.title}</strong>
                            <em>{money(product.price, quote.currency)}</em>
                            <b>
                              {isAlreadyAdded ? "✓ Added" : isSelected ? "✓" : "+ Add"}
                            </b>
                          </button>
                        );
                      })
                    )}
                    <div className={styles.merchantProductDropdownFooter}>
                      <button
                        onClick={() => {
                          setSelectedProducts([]);
                          setIsProductDropdownOpen(false);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <Form method="post">
                        <input
                          name="intent"
                          type="hidden"
                          value="add_quote_items"
                        />
                        <input
                          name="selectedProducts"
                          type="hidden"
                          value={JSON.stringify(selectedProducts)}
                        />
                        <button
                          disabled={selectedProducts.length === 0 || isSubmitting}
                          type="submit"
                        >
                          Confirm
                        </button>
                      </Form>
                    </div>
                  </div>
                )}
              </div>

              <QuoteItemsTable
                currency={quote.currency}
                editAction={editAction}
                firstQuotePriceInputRef={firstQuotePriceInputRef}
                isLockedStatus={isLockedStatus}
                isPriceReadOnly={isPriceReadOnly}
                isSubmitting={isSubmitting}
                isViewMode={isViewMode}
                items={filteredItems}
                orderId={quote.orderId}
                originalTotal={quote.originalTotal}
                quoteTotal={quote.quoteTotal}
              />
            </section>
          </div>

          <QuoteConversation
            focusOnMount={isChatMode}
            messages={quote.messages}
            quoteId={quote.id}
            quoteStatus={quote.status}
          />
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : error instanceof Response
        ? `${error.status} ${error.statusText}`
        : "Unknown quote detail error.";

  return (
    <main className={styles.quoteDetailPage}>
      <section className={styles.quoteDetailShell}>
        <h1>Quote detail error</h1>
        <div className={`${styles.notice} ${styles.noticeError}`}>{message}</div>
        <Link className={styles.secondaryButton} to="/app/quotes">
          Back to quotes
        </Link>
      </section>
    </main>
  );
}
