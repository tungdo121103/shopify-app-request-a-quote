import type { AdminProductSearchData } from "~/features/quotes/quote-product.types";

const currencyNames: Record<string, string> = {
  CAD: "Canadian Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  USD: "US Dollar",
  VND: "Vietnamese Dong",
};

export function formatQuoteMoney(
  value: string | number | null | undefined,
  currency: string,
) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatQuoteDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value || Date.now()));
}

export function getQuoteCurrencyLabel(currency: string) {
  return `${currencyNames[currency] ?? currency} (${currency})`;
}

export async function fetchAdminProducts(
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
