import type { QuoteListData } from "~/models/quote-list.server";

export const DEFAULT_QUOTE_LIST_SORT = "UPDATED_DESC";

export type QuoteListQueryParams = {
  search: string;
  status: string;
  sort: string;
  page: number;
  pageSize: number;
};

export function buildQuotesDataUrl(params: QuoteListQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status !== "ALL") searchParams.set("status", params.status);
  if (params.sort !== DEFAULT_QUOTE_LIST_SORT) {
    searchParams.set("sort", params.sort);
  }
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));

  return `/app/quotes/data?${searchParams.toString()}`;
}

export async function fetchQuotesData(params: QuoteListQueryParams) {
  const response = await fetch(buildQuotesDataUrl(params), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Could not load quotes: HTTP ${response.status}`);
  }

  return (await response.json()) as QuoteListData;
}
