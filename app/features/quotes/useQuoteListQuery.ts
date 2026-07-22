import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { QueryClient, useQuery } from "@tanstack/react-query";
import {
  buildQuotesDataUrl,
  fetchQuotesData,
  type QuoteListQueryParams,
} from "~/features/quotes/quote-list-data";
import type { QuoteListData } from "~/models/quote-list.server";

export function useQuoteListQuery(initialData: QuoteListData) {
  const liveQuotesFetcher = useFetcher<QuoteListData>();
  const expirationJobFetcher = useFetcher<{
    ok?: boolean;
    expiredCount?: number;
    reminderCount?: number;
  }>();
  const expirationJobStartedRef = useRef(false);
  const expirationResultHandledRef = useRef(false);
  const [queryParams, setQueryParams] = useState<QuoteListQueryParams>({
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
      queryKey: quoteListQueryKey(queryParams),
      queryFn: () => fetchQuotesData(queryParams),
      initialData: matchesInitialQuery(queryParams, initialData)
        ? initialData
        : undefined,
      placeholderData: (previousData) => previousData,
    },
    queryClient,
  );

  useEffect(() => {
    if (!liveQuotesFetcher.data) return;
    queryClient.setQueryData(
      quoteListQueryKey(queryParams),
      liveQuotesFetcher.data,
    );
  }, [liveQuotesFetcher.data, queryClient, queryParams]);

  useEffect(() => {
    const refreshQuotes = () => {
      if (
        document.visibilityState === "visible" &&
        liveQuotesFetcher.state === "idle"
      ) {
        liveQuotesFetcher.load(buildQuotesDataUrl(queryParams));
      }
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
  }, [expirationJobFetcher.data, expirationJobFetcher.state, quotesQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.search) window.history.replaceState(null, "", url.pathname);
  }, []);

  useEffect(() => {
    if (quotesQuery.error) {
      console.warn("[RFQ] Could not refresh quote list.", quotesQuery.error);
    }
  }, [quotesQuery.error]);

  useEffect(() => {
    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") void quotesQuery.refetch();
    };
    document.addEventListener("visibilitychange", refetchWhenVisible);
    window.addEventListener("focus", refetchWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refetchWhenVisible);
      window.removeEventListener("focus", refetchWhenVisible);
    };
  }, [quotesQuery]);

  return {
    data: quotesQuery.data ?? initialData,
    queryParams,
    refetch: quotesQuery.refetch,
    updateQuery: (nextParams: Partial<QuoteListQueryParams>) => {
      setQueryParams((current) => ({ ...current, ...nextParams }));
    },
  };
}

function quoteListQueryKey(params: QuoteListQueryParams) {
  return [
    "admin-quotes",
    params.search,
    params.status,
    params.sort,
    params.page,
    params.pageSize,
  ] as const;
}

function matchesInitialQuery(
  params: QuoteListQueryParams,
  initialData: QuoteListData,
) {
  return (
    params.search === initialData.search &&
    params.status === initialData.status &&
    params.sort === initialData.sort &&
    params.page === initialData.pagination.page &&
    params.pageSize === initialData.pagination.pageSize
  );
}
