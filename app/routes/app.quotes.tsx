import type { LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { QuoteDeleteDialog } from "~/components/quotes/QuoteDeleteDialog";
import { QuoteListTable } from "~/components/quotes/QuoteListTable";
import { QuoteListFooter } from "~/components/quotes/QuoteListFooter";
import {
  downloadQuotesCsv,
  type QuoteListItem,
} from "~/features/quotes/quote-list.client";
import { handleQuoteListAction } from "~/features/quotes/quote-list-action.server";
import {
  getQuoteListData,
  type QuoteListData,
} from "~/models/quote-list.server";
import { authenticate } from "~/shopify.server";
import pageStyles from "~/styles/quote-list.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

const statusOptions = [
  { value: "ALL", label: "All" },
  { value: "REQUESTED_BY_CUSTOMER", label: "Requested by customer" },
  { value: "NEGOTIATING", label: "Under negotiation" },
  { value: "OFFERED_BY_MERCHANT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CONVERTED_TO_ORDER", label: "Converted to order" },
] as const;

const sortOptions = [
  { value: "UPDATED_DESC", label: "Recently updated" },
  { value: "CREATED_DESC", label: "Newest first" },
  { value: "CREATED_ASC", label: "Oldest first" },
  { value: "UPDATED_ASC", label: "Least recently updated" },
  { value: "VALUE_DESC", label: "Quote value high to low" },
  { value: "VALUE_ASC", label: "Quote value low to high" },
  { value: "CUSTOMER_ASC", label: "Customer A-Z" },
  { value: "CUSTOMER_DESC", label: "Customer Z-A" },
  { value: "EXPIRES_ASC", label: "Expired time soonest" },
] as const;

const DEFAULT_SORT = "UPDATED_DESC";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getQuoteListData(session.shop, request);
};

export const action = handleQuoteListAction;

type QuoteQueryParams = {
  search: string;
  status: string;
  sort: string;
  page: number;
  pageSize: number;
};

async function fetchQuotesData(params: QuoteQueryParams) {
  const dataUrl = buildQuotesDataUrl(params);
  const response = await fetch(dataUrl, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Could not load quotes: HTTP ${response.status}`);
  }

  return (await response.json()) as QuoteListData;
}

function buildQuotesDataUrl(params: QuoteQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status !== "ALL") searchParams.set("status", params.status);
  if (params.sort !== DEFAULT_SORT) searchParams.set("sort", params.sort);
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));

  return `/app/quotes/data?${searchParams.toString()}`;
}

const icons = {
  view: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M1.8 10s3-5.2 8.2-5.2S18.2 10 18.2 10s-3 5.2-8.2 5.2S1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  ),
  send: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M3 4.2 17 10 3 15.8l2.2-5.8L3 4.2Z" />
      <path d="M5.2 10H12" />
    </svg>
  ),
  convert: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M7.5 3.5h6v6" />
      <path d="M13.5 3.5 6.7 10.3" />
      <path d="M16 11v4.2A1.8 1.8 0 0 1 14.2 17H4.8A1.8 1.8 0 0 1 3 15.2V5.8A1.8 1.8 0 0 1 4.8 4H9" />
    </svg>
  ),
  edit: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M11.2 4H5.4A1.4 1.4 0 0 0 4 5.4v9.2A1.4 1.4 0 0 0 5.4 16h9.2a1.4 1.4 0 0 0 1.4-1.4V8.8" />
      <path d="M9 11.2 15.1 5.1l1.8 1.8-6.1 6.1-2.3.5.5-2.3Z" />
    </svg>
  ),
  reopen: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <rect x="4" y="4" width="12" height="12" rx="1.6" />
      <path d="M10 7v6" />
      <path d="M7 10h6" />
    </svg>
  ),
  download: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M10 3.5v8.2" />
      <path d="m6.8 8.8 3.2 3.2 3.2-3.2" />
      <path d="M4.5 15.8h11" />
    </svg>
  ),
  delete: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M3.8 5.5h12.4" />
      <path d="M8.2 8.2v5.7" />
      <path d="M11.8 8.2v5.7" />
      <path d="m5.5 5.5.7 10.2h7.6l.7-10.2" />
      <path d="M7.8 5.5V4h4.4v1.5" />
    </svg>
  ),
  search: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <circle cx="8.5" cy="8.5" r="5.4" />
      <path d="m12.5 12.5 4 4" />
    </svg>
  ),
  filter: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M3 5h14" />
      <path d="M6 10h8" />
      <path d="M8.5 15h3" />
    </svg>
  ),
  sort: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M7 3v14" />
      <path d="m4.5 5.5 2.5-2.5 2.5 2.5" />
      <path d="M13 17V3" />
      <path d="m10.5 14.5 2.5 2.5 2.5-2.5" />
    </svg>
  ),
  chevronLeft: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M12.5 5 7.5 10l5 5" />
    </svg>
  ),
  chevronRight: (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m7.5 5 5 5-5 5" />
    </svg>
  ),
};

export default function QuotesPage() {
  const initialData = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const deleteFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const quoteActionFetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    quoteId?: string;
    status?: string;
  }>();
  const liveQuotesFetcher = useFetcher<QuoteListData>();
  const expirationJobFetcher = useFetcher<{
    ok?: boolean;
    expiredCount?: number;
    reminderCount?: number;
  }>();
  const expirationJobStartedRef = useRef(false);
  const expirationResultHandledRef = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortPopoverRef = useRef<HTMLDetailsElement>(null);
  const [draftSearch, setDraftSearch] = useState(initialData.search);
  const [queryParams, setQueryParams] = useState<QuoteQueryParams>({
    search: initialData.search,
    status: initialData.status,
    sort: initialData.sort,
    page: initialData.pagination.page,
    pageSize: initialData.pagination.pageSize,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
            staleTime: 1000,
          },
        },
      }),
  );
  const quotesQuery = useQuery<QuoteListData>(
    {
      queryKey: [
        "admin-quotes",
        queryParams.search,
        queryParams.status,
        queryParams.sort,
        queryParams.page,
        queryParams.pageSize,
      ],
      queryFn: () => fetchQuotesData(queryParams),
      initialData:
        queryParams.search === initialData.search &&
        queryParams.status === initialData.status &&
        queryParams.sort === initialData.sort &&
        queryParams.page === initialData.pagination.page &&
        queryParams.pageSize === initialData.pagination.pageSize
          ? initialData
          : undefined,
      placeholderData: (previousData) => previousData,
    },
    queryClient,
  );
  const { quotes, search, status, sort, pagination } =
    quotesQuery.data ?? initialData;
  const isSubmitting = navigation.state === "submitting";
  const activeStatus =
    statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  const activeSort =
    sortOptions.find((option) => option.value === sort) ?? sortOptions[0];
  const [isFilterOpen, setIsFilterOpen] = useState(
    Boolean(search || status !== "ALL"),
  );
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [pendingActionQuoteId, setPendingActionQuoteId] = useState<
    string | null
  >(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<string[]>(
    [],
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    label: string;
    type: "single" | "bulk";
  } | null>(null);
  const visibleQuotes = quotes.filter(
    (quote) => !optimisticDeletedIds.includes(quote.id),
  );
  const visibleQuoteIds = useMemo(
    () => visibleQuotes.map((quote) => quote.id),
    [visibleQuotes],
  );
  const selectedQuotes = visibleQuotes.filter((quote) =>
    selectedQuoteIds.includes(quote.id),
  );
  const selectedFirstQuote = selectedQuotes[0];

  useEffect(() => {
    if (!liveQuotesFetcher.data) return;
    queryClient.setQueryData(
      [
        "admin-quotes",
        queryParams.search,
        queryParams.status,
        queryParams.sort,
        queryParams.page,
        queryParams.pageSize,
      ],
      liveQuotesFetcher.data,
    );
  }, [
    liveQuotesFetcher.data,
    queryClient,
    queryParams.page,
    queryParams.pageSize,
    queryParams.search,
    queryParams.sort,
    queryParams.status,
  ]);

  useEffect(() => {
    const refreshQuotes = () => {
      if (
        document.visibilityState !== "visible" ||
        liveQuotesFetcher.state !== "idle"
      ) {
        return;
      }
      liveQuotesFetcher.load(buildQuotesDataUrl(queryParams));
    };

    const timer = window.setInterval(refreshQuotes, 3000);
    return () => window.clearInterval(timer);
  }, [liveQuotesFetcher, queryParams]);

  useEffect(() => {
    if (expirationJobStartedRef.current) return;
    expirationJobStartedRef.current = true;
    expirationJobFetcher.load("/app/quotes/expiration-job/data");
  }, [expirationJobFetcher]);

  useEffect(() => {
    if (
      expirationResultHandledRef.current ||
      expirationJobFetcher.state !== "idle" ||
      !expirationJobFetcher.data
    ) {
      return;
    }
    expirationResultHandledRef.current = true;
    if (
      Number(expirationJobFetcher.data.expiredCount || 0) > 0 ||
      Number(expirationJobFetcher.data.reminderCount || 0) > 0
    ) {
      void quotesQuery.refetch();
    }
  }, [
    expirationJobFetcher.data,
    expirationJobFetcher.state,
    quotesQuery,
  ]);

  useEffect(() => {
    if (
      navigation.state === "idle" &&
      deleteFetcher.state === "idle" &&
      quoteActionFetcher.state === "idle"
    ) {
      setPendingActionQuoteId(null);
    }
  }, [deleteFetcher.state, navigation.state, quoteActionFetcher.state]);

  useEffect(() => {
    if (quoteActionFetcher.state !== "idle" || !quoteActionFetcher.data) return;
    if (quoteActionFetcher.data.ok) {
      void quotesQuery.refetch();
    }
  }, [quoteActionFetcher.data, quoteActionFetcher.state, quotesQuery]);

  useEffect(() => {
    if (typeof document === "undefined" || !deleteConfirm) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [deleteConfirm]);
  const selectedVisibleQuoteIds = selectedQuoteIds.filter((id) =>
    visibleQuoteIds.includes(id),
  );
  const openQuote = (
    quoteId: string,
    params: { mode?: "view" | "edit"; focus?: "chat" } = {},
  ) => {
    const search = new URLSearchParams(location.search);
    search.delete("page");
    search.delete("pageSize");
    search.delete("search");
    search.delete("status");
    search.delete("sort");
    search.delete("mode");
    search.delete("focus");
    if (params.mode) search.set("mode", params.mode);
    if (params.focus) search.set("focus", params.focus);
    const query = search.toString();
    navigate(`/app/quotes/${quoteId}${query ? `?${query}` : ""}`);
  };
  const downloadQuotePdf = (quoteId: string) => {
    const search = new URLSearchParams(location.search);
    search.delete("page");
    search.delete("pageSize");
    search.delete("search");
    search.delete("status");
    search.delete("sort");
    search.delete("mode");
    search.delete("focus");
    const query = search.toString();
    window.location.href = `/app/quotes/${quoteId}/pdf${query ? `?${query}` : ""}`;
  };
  const allVisibleQuotesSelected =
    visibleQuoteIds.length > 0 &&
    selectedVisibleQuoteIds.length === visibleQuoteIds.length;
  const hasSelectedQuotes = selectedQuoteIds.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.search) return;
    window.history.replaceState(null, "", url.pathname);
  }, []);

  useEffect(() => {
    if (!quotesQuery.error) return;
    console.warn("[RFQ] Could not refresh quote list.", quotesQuery.error);
  }, [quotesQuery.error]);

  useEffect(() => {
    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void quotesQuery.refetch();
      }
    };
    document.addEventListener("visibilitychange", refetchWhenVisible);
    window.addEventListener("focus", refetchWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refetchWhenVisible);
      window.removeEventListener("focus", refetchWhenVisible);
    };
  }, [quotesQuery]);

  useEffect(() => {
    if (!isSortOpen) return;

    const closeSortOnOutsideClick = (event: MouseEvent) => {
      if (
        sortPopoverRef.current &&
        !sortPopoverRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", closeSortOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeSortOnOutsideClick);
    };
  }, [isSortOpen]);

  useEffect(() => {
    setSelectedQuoteIds((current) =>
      current.filter((id) => visibleQuoteIds.includes(id)),
    );
  }, [visibleQuoteIds]);

  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuoteIds((current) =>
      current.includes(quoteId)
        ? current.filter((id) => id !== quoteId)
        : [...current, quoteId],
    );
  };

  const toggleAllVisibleQuotes = () => {
    setSelectedQuoteIds(allVisibleQuotesSelected ? [] : visibleQuoteIds);
  };

  const exportSelectedQuotes = () => {
    downloadQuotesCsv(selectedQuotes as QuoteListItem[]);
  };

  const requestDeleteQuote = (quote: QuoteListItem) => {
    setDeleteConfirm({
      ids: [quote.id],
      label: quote.quoteNumber,
      type: "single",
    });
  };

  const requestBulkDeleteQuotes = () => {
    if (selectedQuoteIds.length === 0) return;
    setDeleteConfirm({
      ids: selectedQuoteIds,
      label: `${selectedQuoteIds.length} selected quotes`,
      type: "bulk",
    });
  };

  const confirmDeleteQuotes = () => {
    if (!deleteConfirm) return;
    const nextIds = deleteConfirm.ids;
    setOptimisticDeletedIds((current) =>
      Array.from(new Set([...current, ...nextIds])),
    );
    setSelectedQuoteIds((current) =>
      current.filter((id) => !nextIds.includes(id)),
    );
    setPendingActionQuoteId(
      deleteConfirm.type === "single" ? deleteConfirm.ids[0] : "__bulk__",
    );

    const formData = new FormData();
    formData.set(
      "intent",
      deleteConfirm.type === "bulk" ? "bulk-delete" : "delete",
    );
    if (deleteConfirm.type === "single") {
      formData.set("quoteId", deleteConfirm.ids[0]);
    } else {
      deleteConfirm.ids.forEach((id) => formData.append("quoteIds", id));
    }
    setDeleteConfirm(null);
    deleteFetcher.submit(formData, { method: "post" });
  };

  const page = pagination.page;
  const totalPages = pagination.totalPages;
  const updateQuery = (nextParams: Partial<QuoteQueryParams>) => {
    setQueryParams((current) => ({ ...current, ...nextParams }));
  };

  const submitQuoteAction = (quoteId: string, intent: "reopen" | "revise") => {
    if (quoteActionFetcher.state !== "idle") return;
    setPendingActionQuoteId(quoteId);
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("quoteId", quoteId);
    quoteActionFetcher.submit(formData, { method: "post" });
  };

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.kicker}>Request a Quote</p>
          <h1 className={styles.adminTitle}>Manage quotes</h1>
        </div>
      </header>

      <section className={styles.managerCard}>
        <div className={styles.managerTopbar}>
          <div className={styles.statusTabs} aria-label="Quote status tabs">
            {statusOptions.slice(0, 1).map((option) => (
              <button
                className={`${styles.statusTab} ${
                  status === option.value ? styles.statusTabActive : ""
                }`}
                key={option.value}
                onClick={() => updateQuery({ status: "ALL", page: 1 })}
                type="button"
              >
                {option.label}
              </button>
            ))}
            {status !== "ALL" && (
              <span className={`${styles.statusTab} ${styles.statusTabActive}`}>
                {activeStatus.label}
              </span>
            )}
            {sort !== DEFAULT_SORT && (
              <span className={`${styles.statusTab} ${styles.statusTabActive}`}>
                {activeSort.label}
              </span>
            )}
          </div>

          <div className={styles.managerIconTools}>
            <button
              aria-expanded={isFilterOpen}
              className={`${styles.toolButton} ${
                isFilterOpen ? styles.toolButtonActive : ""
              }`}
              onClick={() => {
                setIsFilterOpen((value) => !value);
              }}
              type="button"
              title="Search and filter"
            >
              {icons.search}
              {icons.filter}
            </button>
            <details
              className={styles.sortPopover}
              onToggle={(event) => {
                setIsSortOpen(event.currentTarget.open);
              }}
              open={isSortOpen}
              ref={sortPopoverRef}
            >
              <summary
                className={`${styles.toolButton} ${
                  sort !== DEFAULT_SORT ? styles.toolButtonActive : ""
                }`}
                title={`Sort: ${activeSort.label}`}
              >
                {icons.sort}
              </summary>
              <div className={styles.sortMenu}>
                <div className={styles.sortMenuTitle}>Sort by</div>
                {sortOptions.map((option) => (
                  <button
                    className={`${styles.sortMenuItem} ${
                      option.value === sort ? styles.sortMenuItemActive : ""
                    }`}
                    key={option.value}
                    onClick={() => {
                      updateQuery({ sort: option.value, page: 1 });
                      setIsSortOpen(false);
                    }}
                    type="button"
                  >
                    <span>{option.value === sort ? "✓" : ""}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>

        {isFilterOpen && (
          <Form
            className={styles.managerFilters}
            method="get"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              className={styles.managerSearch}
              value={draftSearch}
              name="search"
              onChange={(event) => {
                const nextSearch = event.currentTarget.value;
                setDraftSearch(nextSearch);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => {
                  updateQuery({ search: nextSearch, page: 1 });
                }, 500);
              }}
              placeholder="Search by quote, customer or email..."
            />
            <select
              className={styles.managerSelect}
              value={status}
              name="status"
              onChange={(event) => {
                updateQuery({ status: event.currentTarget.value, page: 1 });
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={pagination.pageSize} />
            {sort !== DEFAULT_SORT && (
              <input name="sort" type="hidden" value={sort} />
            )}
            <button
              className={styles.filterReset}
              onClick={() => {
                if (searchTimer.current) clearTimeout(searchTimer.current);
                setDraftSearch("");
                setQueryParams({
                  search: "",
                  status: "ALL",
                  sort: DEFAULT_SORT,
                  page: 1,
                  pageSize: pagination.pageSize,
                });
              }}
              type="button"
            >
              Reset
            </button>
          </Form>
        )}

        {hasSelectedQuotes && (
          <Form className={styles.bulkActionBar} method="post">
            <span>{selectedQuoteIds.length} selected</span>
            {selectedQuoteIds.map((id) => (
              <input key={id} name="quoteIds" type="hidden" value={id} />
            ))}
            <div className={styles.bulkIconActions}>
              {selectedQuotes.length === 1 && selectedFirstQuote ? (
                <button
                  aria-label={`View ${selectedFirstQuote.quoteNumber}`}
                  className={styles.bulkIconButton}
                  onClick={() => openQuote(selectedFirstQuote.id, { mode: "view" })}
                  title="View selected quote"
                  type="button"
                >
                  {icons.view}
                </button>
              ) : (
                <button
                  aria-label="Select one quote to view"
                  className={`${styles.bulkIconButton} ${styles.bulkIconButtonDisabled}`}
                  disabled
                  title="Select one quote to view"
                  type="button"
                >
                  {icons.view}
                </button>
              )}
              <button
                aria-label="Export selected quotes"
                className={styles.bulkIconButton}
                onClick={exportSelectedQuotes}
                title="Export selected quotes"
                type="button"
              >
                {icons.download}
              </button>
              <button
                aria-label="Delete selected quotes"
                className={`${styles.bulkIconButton} ${styles.bulkIconDanger}`}
                disabled={isSubmitting || pendingActionQuoteId === "__bulk__"}
                name="intent"
                onClick={requestBulkDeleteQuotes}
                title="Delete selected quotes"
                type="button"
                value="bulk-delete"
              >
                {pendingActionQuoteId === "__bulk__" ? (
                  <span className={styles.managerActionSpinner} />
                ) : (
                  icons.delete
                )}
              </button>
            </div>
          </Form>
        )}
        <QuoteListTable
          allSelected={allVisibleQuotesSelected}
          isSubmitting={isSubmitting}
          onDeleteQuote={requestDeleteQuote}
          onDownloadPdf={downloadQuotePdf}
          onOpenQuote={openQuote}
          onQuoteAction={submitQuoteAction}
          onToggleAll={toggleAllVisibleQuotes}
          onToggleQuote={toggleQuoteSelection}
          pendingActionQuoteId={pendingActionQuoteId}
          quotes={visibleQuotes}
          selectedQuoteIds={selectedQuoteIds}
        />
        <QuoteListFooter
          onChange={updateQuery}
          page={page}
          pageSize={pagination.pageSize}
          totalPages={totalPages}
        />
      </section>
      {deleteConfirm ? (
        <QuoteDeleteDialog
          label={deleteConfirm.label}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={confirmDeleteQuotes}
        />
      ) : null}
    </main>
  );
}
