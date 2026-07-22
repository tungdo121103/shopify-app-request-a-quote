import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
  useSearchParams,
} from "react-router";
import { QuoteDetailHeader } from "~/components/quotes/QuoteDetailHeader";
import { QuoteInformationCard } from "~/components/quotes/QuoteInformationCard";
import { QuoteItemsTable } from "~/components/quotes/QuoteItemsTable";
import { QuoteConversation } from "~/components/quotes/QuoteConversation";
import { QuoteProductPicker } from "~/components/quotes/QuoteProductPicker";
import { handleQuoteDetailAction } from "~/features/quotes/quote-detail-action.server";
import {
  formatQuoteDateTime,
  getQuoteCurrencyLabel,
} from "~/features/quotes/quote-detail";
import { handleQuoteDetailLoader } from "~/features/quotes/quote-detail-loader.server";
import pageStyles from "~/styles/quote-detail.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

export const loader = handleQuoteDetailLoader;


export const action = handleQuoteDetailAction;

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
  const firstQuotePriceInputRef = useRef<HTMLInputElement>(null);
  const draftOrderWindowRef = useRef<Window | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const isSubmitting = navigation.state === "submitting";
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
  const currencyLabel = getQuoteCurrencyLabel(quote.currency);
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
              createdDate={formatQuoteDateTime(quote.createdAt)}
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
              <QuoteProductPicker
                actionCompleted={Boolean(
                  actionData?.ok &&
                    actionData.message === "Products added to quote.",
                )}
                actionResult={actionData}
                currency={quote.currency}
                currentSearch={location.search}
                disabled={isViewMode || isLockedStatus || Boolean(quote.orderId)}
                existingProductKeys={existingProductKeys}
                isSubmitting={isSubmitting}
                onSearchChange={setItemSearch}
                pathname={location.pathname}
                searchQuery={debouncedItemSearch}
                value={itemSearch}
              />

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
