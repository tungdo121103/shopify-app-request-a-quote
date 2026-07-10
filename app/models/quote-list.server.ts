import { listQuotes } from "~/models/quote.server";

export async function getQuoteListData(shop: string, request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "ALL";
  const sort = url.searchParams.get("sort") ?? "UPDATED_DESC";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 10)),
  );
  const { quotes, pagination } = await listQuotes(shop, {
    search,
    status,
    sort,
    page,
    pageSize,
  });

  return { quotes, search, status, sort, pagination };
}

export type QuoteListData = Awaited<ReturnType<typeof getQuoteListData>>;
